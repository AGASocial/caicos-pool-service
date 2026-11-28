/**
 * KAN-154: switches and guards for the Monday open-issues digest.
 *
 * Nothing here has side effects. The enable flag and the recipient guard are deliberately
 * separate: turning the flag on never relaxes the non-production QA recipient guard.
 */

export const DIGEST_TIME_ZONE = 'America/New_York';

/** Only `1`, `true` and `yes` (any case) enable the digest; unset or anything else is off. */
export function isMondayDigestEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  const raw = env.MONDAY_DIGEST_ENABLED?.trim().toLowerCase();
  return raw === '1' || raw === 'true' || raw === 'yes';
}

const QA_RECIPIENT_RE = /^qa-billing-[a-z0-9-]+@cadenzaops\.com$/i;
const EMAIL_RE = /^[^\s@<>,;]+@[^\s@<>,;]+\.[^\s@<>,;]+$/;

/**
 * Recipient guard. Outside Vercel production only `qa-billing-…@cadenzaops.com` is allowed;
 * in production any well-formed address is allowed (callers only ever pass office-role users).
 * There is intentionally no environment override.
 */
export function isAllowedDigestRecipient(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = email?.trim();
  if (!value) return false;
  if (env.VERCEL_ENV !== 'production') return QA_RECIPIENT_RE.test(value);
  return EMAIL_RE.test(value);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Comma-separated company UUIDs from MONDAY_DIGEST_COMPANY_IDS. Empty array = no allow-list. */
export function parseMondayDigestCompanyIds(env: NodeJS.ProcessEnv = process.env): string[] {
  const raw = env.MONDAY_DIGEST_COMPANY_IDS;
  if (!raw) return [];
  const ids = raw
    .split(',')
    .map((part) => part.trim().toLowerCase())
    .filter((part) => UUID_RE.test(part));
  return [...new Set(ids)];
}

/** True when MONDAY_DIGEST_COMPANY_IDS is set to something, even if every entry is invalid. */
export function hasMondayDigestAllowList(env: NodeJS.ProcessEnv = process.env): boolean {
  return Boolean(env.MONDAY_DIGEST_COMPANY_IDS?.trim());
}

/** `YYYY-MM-DD` of the Monday of the America/New_York week that contains `now`. */
export function weekStartMonday(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: DIGEST_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  const sinceMonday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(get('weekday'));
  const day = Date.UTC(Number(get('year')), Number(get('month')) - 1, Number(get('day')));
  return new Date(day - Math.max(0, sinceMonday) * 86_400_000).toISOString().slice(0, 10);
}
