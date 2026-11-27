/**
 * KAN-153: review of a carry-forward open issue ("Resolved? Yes / No").
 *
 * The database function `review_open_issue` is the enforcement point. This module mirrors its
 * preconditions in TypeScript so the API can return precise errors before the call, and so the
 * rules are unit-testable.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { reportNeedsFollowUp, type OpenIssueSource } from '@/lib/follow-up-jobs';
import { isOpenIssuesSchemaPending, OpenIssuesSchemaPendingError } from '@/lib/open-issues';

export const OFFICE_ROLES = new Set(['owner', 'admin', 'operations']);

export type ReviewInput = {
  source: OpenIssueSource;
  id: string;
  review_job_id: string;
  resolved: boolean;
  note?: string | null;
};

export type ReviewJob = {
  id: string;
  company_id: string;
  property_id: string | null;
  technician_id: string | null;
  is_deleted?: boolean | null;
};

export type ReviewIssueRow = {
  company_id: string;
  job_id: string;
  open: boolean;
};

export type ReviewAccessInput = {
  userId: string;
  role: string | null | undefined;
  companyId: string;
  reviewJob: ReviewJob | null;
  issue: ReviewIssueRow | null;
  originJob: ReviewJob | null;
  reviewJobId: string;
};

export type ReviewAccessResult = { allowed: true } | { allowed: false; status: number; error: string };

const deny = (status: number, error: string): ReviewAccessResult => ({ allowed: false, status, error });

/** Mirrors the preconditions of the `review_open_issue` database function. */
export function evaluateReviewAccess(input: ReviewAccessInput): ReviewAccessResult {
  const { userId, role, companyId, reviewJob, issue, originJob, reviewJobId } = input;

  if (!reviewJob || reviewJob.is_deleted || reviewJob.company_id !== companyId) {
    return deny(404, 'Review job not found');
  }

  const isOffice = role != null && OFFICE_ROLES.has(role);
  if (!isOffice && reviewJob.technician_id !== userId) {
    return deny(403, 'Forbidden');
  }

  if (!issue || issue.company_id !== companyId) {
    return deny(404, 'Issue not found');
  }
  if (!issue.open) {
    return deny(409, 'Issue is not open');
  }
  if (issue.job_id === reviewJobId) {
    return deny(400, 'Carry-forward review must happen on a later job');
  }

  if (
    !originJob ||
    originJob.is_deleted ||
    originJob.company_id !== companyId ||
    !originJob.property_id ||
    originJob.property_id !== reviewJob.property_id
  ) {
    return deny(403, 'Forbidden');
  }

  return { allowed: true };
}

/** Maps a `review_open_issue` database error to an HTTP status/body. */
export function mapReviewRpcError(error: { code?: string; message?: string }): {
  status: number;
  body: { error: string; code?: string };
} {
  const message = error.message ?? '';
  if (isOpenIssuesSchemaPending(error) || error.code === 'PGRST202') {
    return {
      status: 503,
      body: { error: 'Open-issue schema is not available yet', code: 'SCHEMA_PENDING' },
    };
  }
  if (message.includes('not_authenticated')) return { status: 401, body: { error: 'Unauthorized' } };
  if (message.includes('forbidden')) return { status: 403, body: { error: 'Forbidden' } };
  if (message.includes('review_job_not_found')) return { status: 404, body: { error: 'Review job not found' } };
  if (message.includes('issue_not_open')) return { status: 409, body: { error: 'Issue is not open' } };
  if (message.includes('invalid_') || message.includes('same_job')) {
    return { status: 400, body: { error: 'Invalid review request' } };
  }
  return { status: 500, body: { error: 'Failed to record review' } };
}

export function parseReviewBody(body: unknown):
  | { ok: true; input: ReviewInput }
  | { ok: false; error: string } {
  if (!body || typeof body !== 'object') return { ok: false, error: 'Invalid JSON body' };
  const b = body as Record<string, unknown>;
  if (b.source !== 'service_report' && b.source !== 'voice_note') {
    return { ok: false, error: 'source must be service_report or voice_note' };
  }
  if (typeof b.id !== 'string' || !b.id.trim()) return { ok: false, error: 'id is required' };
  if (typeof b.review_job_id !== 'string' || !b.review_job_id.trim()) {
    return { ok: false, error: 'review_job_id is required' };
  }
  if (typeof b.resolved !== 'boolean') return { ok: false, error: 'resolved must be a boolean' };
  const note = typeof b.note === 'string' && b.note.trim() ? b.note.trim().slice(0, 2000) : null;
  return {
    ok: true,
    input: {
      source: b.source,
      id: b.id.trim(),
      review_job_id: b.review_job_id.trim(),
      resolved: b.resolved,
      note,
    },
  };
}

async function loadJob(client: SupabaseClient, jobId: string): Promise<ReviewJob | null> {
  const { data } = await client
    .from('cadenza_service_jobs')
    .select('id, company_id, property_id, technician_id, is_deleted')
    .eq('id', jobId)
    .maybeSingle();
  return data
    ? {
        id: String(data.id),
        company_id: String(data.company_id),
        property_id: data.property_id != null ? String(data.property_id) : null,
        technician_id: data.technician_id != null ? String(data.technician_id) : null,
        is_deleted: data.is_deleted as boolean | null,
      }
    : null;
}

async function loadIssue(
  client: SupabaseClient,
  input: ReviewInput,
): Promise<ReviewIssueRow | null> {
  if (input.source === 'service_report') {
    const { data, error } = await client
      .from('cadenza_service_reports')
      .select('company_id, job_id, follow_up_needed, issue_categories, follow_up_status, is_deleted')
      .eq('id', input.id)
      .maybeSingle();
    if (error && isOpenIssuesSchemaPending(error)) throw new OpenIssuesSchemaPendingError();
    if (!data) return null;
    return {
      company_id: String(data.company_id),
      job_id: String(data.job_id),
      open:
        data.is_deleted !== true &&
        reportNeedsFollowUp({
          job_id: String(data.job_id),
          follow_up_needed: data.follow_up_needed as boolean | null,
          issue_categories: data.issue_categories as string[] | null,
          follow_up_status: data.follow_up_status as string | null,
        }),
    };
  }

  const { data, error } = await client
    .from('cadenza_job_voice_notes')
    .select('company_id, job_id, category, status, follow_up_status')
    .eq('id', input.id)
    .maybeSingle();
  if (error && isOpenIssuesSchemaPending(error)) throw new OpenIssuesSchemaPendingError();
  if (!data) return null;
  return {
    company_id: String(data.company_id),
    job_id: String(data.job_id),
    open: data.category === 'problem' && data.status === 'done' && data.follow_up_status !== 'resolved',
  };
}

export type ReviewResult = { status: number; body: Record<string, unknown> };

/** Pre-checks access, then records the review through the `review_open_issue` RPC. */
export async function reviewOpenIssue(
  client: SupabaseClient,
  caller: { userId: string; role: string | null | undefined; companyId: string },
  input: ReviewInput,
): Promise<ReviewResult> {
  let reviewJob: ReviewJob | null;
  let issue: ReviewIssueRow | null;
  try {
    [reviewJob, issue] = await Promise.all([
      loadJob(client, input.review_job_id),
      loadIssue(client, input),
    ]);
  } catch (error) {
    if (error instanceof OpenIssuesSchemaPendingError) {
      return { status: 503, body: { error: error.message, code: 'SCHEMA_PENDING' } };
    }
    throw error;
  }
  const originJob = issue ? await loadJob(client, issue.job_id) : null;

  const access = evaluateReviewAccess({
    ...caller,
    reviewJob,
    issue,
    originJob,
    reviewJobId: input.review_job_id,
  });
  if (!access.allowed) return { status: access.status, body: { error: access.error } };

  const { data, error } = await client.rpc('review_open_issue', {
    p_source: input.source,
    p_id: input.id,
    p_review_job_id: input.review_job_id,
    p_resolved: input.resolved,
    p_note: input.note ?? null,
  });

  if (error) {
    const mapped = mapReviewRpcError(error);
    if (mapped.status === 500) console.error('review_open_issue failed:', error.message);
    return { status: mapped.status, body: mapped.body };
  }

  return { status: 200, body: (data as Record<string, unknown>) ?? { ok: true } };
}
