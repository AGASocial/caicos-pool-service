/**
 * KAN-154: Monday digest of open issues.
 *
 * "Open" is defined once, by `fetchOpenIssues` (KAN-153 union of open follow-up reports and
 * unresolved problem voice notes). This module only groups that set per technician and emails it
 * to each company's office-role users. It never reads customer or property emails.
 *
 * Safety order inside `runMondayDigest`: enable flag (first), allow-list, send-log schema check,
 * QA recipient guard, then send. Every query is filtered by company_id.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { sendMondayDigestEmail, type DigestSendResult } from '@/lib/email/digest-mailer';
import { groupIssuesByTechnician, type OpenIssue, type TechnicianIssueGroup } from '@/lib/follow-up-jobs';
import {
  fetchOpenIssues,
  fetchPropertiesForIssues,
  isOpenIssuesSchemaPending,
  OpenIssuesSchemaPendingError,
  type PropertyIdentity,
} from '@/lib/open-issues';
import { OFFICE_ROLES } from '@/lib/open-issues-review';
import {
  hasMondayDigestAllowList,
  isAllowedDigestRecipient,
  isMondayDigestEnabled,
  parseMondayDigestCompanyIds,
  weekStartMonday,
} from '@/lib/monday-digest-config';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export {
  isAllowedDigestRecipient,
  isMondayDigestEnabled,
  parseMondayDigestCompanyIds,
  weekStartMonday,
} from '@/lib/monday-digest-config';

export type DigestIssue = OpenIssue & { property: PropertyIdentity | null };

export type DigestTechnicianGroup<T extends OpenIssue = OpenIssue> = TechnicianIssueGroup<T>;

/** Groups issues by technician, oldest first inside each group (see `groupIssuesByTechnician`). */
export function buildMondayDigest<T extends OpenIssue>(issues: T[]): DigestTechnicianGroup<T>[] {
  return groupIssuesByTechnician(issues);
}

export type MondayDigestResult = {
  ok: boolean;
  skipped?: boolean;
  reason?: 'disabled' | 'schema_pending';
  week_start?: string;
  companies_considered?: number;
  companies_emailed?: number;
  companies_without_issues?: number;
  companies_without_recipients?: number;
  emails_sent?: number;
  recipients_not_allowed?: number;
  recipients_already_sent?: number;
  errors?: number;
};

export type RunMondayDigestOptions = {
  now?: Date;
  env?: NodeJS.ProcessEnv;
  /** Service-role client (defaults to the shared admin client). */
  client?: SupabaseClient;
  /** Mail sender (defaults to the Resend digest mailer). */
  send?: typeof sendMondayDigestEmail;
};

type DbError = { code?: string; message?: string } | null | undefined;

/** The send-log table is missing (migration not applied): PostgREST reports PGRST205 / 42P01. */
export function isDigestSchemaPending(error: DbError): boolean {
  return (
    Boolean(error) &&
    (error?.code === 'PGRST205' || error?.code === '42P01' || isOpenIssuesSchemaPending(error))
  );
}

type Recipient = { email: string; locale: string };

/** Office-role users of one company, deduplicated by email. Never customers or technicians. */
async function loadOfficeRecipients(
  client: SupabaseClient,
  companyId: string,
  env: NodeJS.ProcessEnv,
  counters: { notAllowed: number },
): Promise<Recipient[]> {
  const { data, error } = await client
    .from('cadenza_profiles')
    .select('id, email, role, is_active')
    .eq('company_id', companyId)
    .in('role', [...OFFICE_ROLES]);
  if (error) throw new Error(`monday-digest profiles: ${error.message}`);

  const byEmail = new Map<string, Recipient>();
  for (const row of data ?? []) {
    if (row.is_active === false || !OFFICE_ROLES.has(String(row.role))) continue;
    let email = typeof row.email === 'string' ? row.email.trim() : '';
    let locale = 'en';
    // Drop disallowed recipients before any further lookup.
    if (email && !isAllowedDigestRecipient(email, env)) {
      counters.notAllowed += 1;
      continue;
    }
    try {
      const { data: auth } = await client.auth.admin.getUserById(String(row.id));
      const meta = auth?.user?.user_metadata as Record<string, unknown> | undefined;
      const metaLocale = meta?.locale ?? meta?.preferred_locale;
      if (typeof metaLocale === 'string' && metaLocale) locale = metaLocale;
      if (!email && auth?.user?.email) email = auth.user.email.trim();
    } catch {
      // Locale lookup is best effort; the profile email is enough to send.
    }
    if (!email) continue;
    if (!isAllowedDigestRecipient(email, env)) {
      counters.notAllowed += 1;
      continue;
    }
    byEmail.set(email.toLowerCase(), { email, locale });
  }
  return [...byEmail.values()];
}

async function alreadySentEmails(
  client: SupabaseClient,
  companyId: string,
  weekStart: string,
): Promise<Set<string>> {
  const { data, error } = await client
    .from('cadenza_monday_digest_sends')
    .select('recipient_email')
    .eq('company_id', companyId)
    .eq('week_start', weekStart);
  if (error) throw error;
  return new Set((data ?? []).map((row) => String(row.recipient_email).toLowerCase()));
}

async function listCompanyIds(client: SupabaseClient, env: NodeJS.ProcessEnv): Promise<string[]> {
  const allowList = parseMondayDigestCompanyIds(env);
  // An allow-list that is set but holds no valid UUID fails closed: nobody is emailed.
  if (hasMondayDigestAllowList(env) && allowList.length === 0) return [];
  let query = client.from('cadenza_companies').select('id');
  if (allowList.length > 0) query = query.in('id', allowList);
  const { data, error } = await query;
  if (error) throw new Error(`monday-digest companies: ${error.message}`);
  return (data ?? []).map((row) => String(row.id));
}

/**
 * Runs the digest for every eligible company. Returns `skipped` immediately, before touching the
 * database or the mailer, when MONDAY_DIGEST_ENABLED is not truthy.
 */
export async function runMondayDigest(options: RunMondayDigestOptions = {}): Promise<MondayDigestResult> {
  const env = options.env ?? process.env;
  if (!isMondayDigestEnabled(env)) return { ok: true, skipped: true, reason: 'disabled' };

  const now = options.now ?? new Date();
  const client = options.client ?? getSupabaseAdmin();
  const send = options.send ?? sendMondayDigestEmail;
  const weekStart = weekStartMonday(now);

  // The send-log is what makes retries safe. Without it, send nothing at all.
  const probe = await client.from('cadenza_monday_digest_sends').select('id').limit(1);
  if (probe.error) {
    if (isDigestSchemaPending(probe.error)) {
      console.warn('monday-digest: send-log table is not available yet; nothing sent');
      return { ok: false, skipped: true, reason: 'schema_pending', week_start: weekStart };
    }
    throw new Error(`monday-digest send-log probe: ${probe.error.message}`);
  }

  const result = {
    companies_considered: 0,
    companies_emailed: 0,
    companies_without_issues: 0,
    companies_without_recipients: 0,
    emails_sent: 0,
    recipients_not_allowed: 0,
    recipients_already_sent: 0,
    errors: 0,
  };

  const companyIds = await listCompanyIds(client, env);
  for (const companyId of companyIds) {
    result.companies_considered += 1;
    try {
      const issues = await fetchOpenIssues(client, companyId, { now });
      if (issues.length === 0) {
        result.companies_without_issues += 1;
        continue;
      }

      const counters = { notAllowed: 0 };
      const recipients = await loadOfficeRecipients(client, companyId, env, counters);
      result.recipients_not_allowed += counters.notAllowed;
      if (recipients.length === 0) {
        result.companies_without_recipients += 1;
        continue;
      }

      const sentBefore = await alreadySentEmails(client, companyId, weekStart);
      const pending = recipients.filter((r) => !sentBefore.has(r.email.toLowerCase()));
      result.recipients_already_sent += recipients.length - pending.length;
      if (pending.length === 0) continue;

      const properties = await fetchPropertiesForIssues(client, companyId, issues);
      const groups = buildMondayDigest<DigestIssue>(
        issues.map((issue) => ({
          ...issue,
          property: issue.property_id ? (properties.get(issue.property_id) ?? null) : null,
        })),
      );

      let emailedThisCompany = false;
      for (const recipient of pending) {
        const outcome: DigestSendResult = await send({
          to: recipient.email,
          locale: recipient.locale,
          companyId,
          weekStart,
          groups,
          issueCount: issues.length,
        });
        if (!outcome.sent) {
          if (outcome.reason === 'recipient_not_allowed') result.recipients_not_allowed += 1;
          else if (outcome.reason === 'send_failed') result.errors += 1;
          continue;
        }
        result.emails_sent += 1;
        emailedThisCompany = true;
        const { error: logError } = await client.from('cadenza_monday_digest_sends').insert({
          company_id: companyId,
          week_start: weekStart,
          recipient_email: recipient.email.toLowerCase(),
          resend_message_id: outcome.messageId,
          issue_count: issues.length,
        });
        // 23505 = another run already logged this recipient/week; that is the idempotent outcome.
        if (logError && logError.code !== '23505') {
          result.errors += 1;
          console.error('monday-digest: could not write send-log row:', logError.message);
        }
      }
      if (emailedThisCompany) result.companies_emailed += 1;
    } catch (error) {
      if (error instanceof OpenIssuesSchemaPendingError || isDigestSchemaPending(error as DbError)) {
        console.warn('monday-digest: schema not ready for a company; skipped');
      } else {
        console.error('monday-digest: company run failed:', error instanceof Error ? error.message : error);
      }
      result.errors += 1;
    }
  }

  return { ok: true, week_start: weekStart, ...result };
}
