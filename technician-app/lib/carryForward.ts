import { supabase } from '@/lib/supabase';
import {
  truncateSummary,
  type CarryForwardIssue,
  type CarryForwardSource,
} from '@/lib/carryForwardCore';

export * from '@/lib/carryForwardCore';

type ReportRow = {
  id: string;
  job_id: string;
  created_at: string;
  follow_up_notes: string | null;
  follow_up_needed: boolean | null;
  issue_categories: string[] | null;
  last_reviewed_job_id: string | null;
  cadenza_service_jobs:
    | { property_id: string; is_deleted: boolean | null }
    | Array<{ property_id: string; is_deleted: boolean | null }>
    | null;
};

type VoiceNoteRow = {
  id: string;
  job_id: string;
  property_id: string | null;
  created_at: string;
  model_reason: string | null;
  model_explanation: string | null;
  transcript: string | null;
  last_reviewed_job_id: string | null;
};

function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

/**
 * Open issues (open follow-up reports + unresolved problem voice notes) at the given
 * properties. Reads go through RLS (company SELECT). Throws on query errors so the screen can
 * show the failure instead of an empty list.
 */
export async function fetchOpenIssuesForProperties(
  propertyIds: string[],
): Promise<CarryForwardIssue[]> {
  const ids = [...new Set(propertyIds.filter(Boolean))];
  if (ids.length === 0) return [];

  const [reportsRes, notesRes] = await Promise.all([
    supabase
      .from('cadenza_service_reports')
      .select(
        'id, job_id, created_at, follow_up_notes, follow_up_needed, issue_categories, last_reviewed_job_id, cadenza_service_jobs!job_id!inner(property_id, is_deleted)',
      )
      .eq('follow_up_status', 'open')
      .eq('is_deleted', false)
      .or('follow_up_needed.eq.true,issue_categories.neq.{}')
      .in('cadenza_service_jobs.property_id', ids),
    supabase
      .from('cadenza_job_voice_notes')
      .select(
        'id, job_id, property_id, created_at, model_reason, model_explanation, transcript, last_reviewed_job_id',
      )
      .eq('category', 'problem')
      .eq('status', 'done')
      .or('follow_up_status.is.null,follow_up_status.neq.resolved')
      .in('property_id', ids),
  ]);

  if (reportsRes.error) throw new Error(reportsRes.error.message);
  if (notesRes.error) throw new Error(notesRes.error.message);

  const issues: CarryForwardIssue[] = [];

  for (const row of (reportsRes.data ?? []) as unknown as ReportRow[]) {
    const job = firstOf(row.cadenza_service_jobs);
    if (!job || job.is_deleted) continue;
    issues.push({
      source: 'service_report',
      id: row.id,
      job_id: row.job_id,
      property_id: job.property_id,
      created_at: row.created_at,
      summary: truncateSummary(row.follow_up_notes),
      issue_categories: row.issue_categories ?? [],
      reviewed_on_job_id: row.last_reviewed_job_id,
    });
  }

  for (const row of (notesRes.data ?? []) as unknown as VoiceNoteRow[]) {
    if (!row.property_id) continue;
    issues.push({
      source: 'voice_note',
      id: row.id,
      job_id: row.job_id,
      property_id: row.property_id,
      created_at: row.created_at,
      summary: truncateSummary(row.model_reason ?? row.model_explanation ?? row.transcript),
      issue_categories: [],
      reviewed_on_job_id: row.last_reviewed_job_id,
    });
  }

  return issues;
}

/** Persists "Resolved? Yes/No" through the narrow review_open_issue RPC. */
export async function reviewOpenIssue(params: {
  source: CarryForwardSource;
  id: string;
  reviewJobId: string;
  resolved: boolean;
}): Promise<void> {
  const { error } = await supabase.rpc('review_open_issue', {
    p_source: params.source,
    p_id: params.id,
    p_review_job_id: params.reviewJobId,
    p_resolved: params.resolved,
    p_note: null,
  });
  if (error) throw new Error(error.message);
}
