/**
 * Open voice-note problems by effective category (KAN-153 carry-forward, KAN-154 digest).
 *
 * "Open" = effective `category = 'problem'`, `status = 'done'` and `follow_up_status` not
 * `'resolved'`. Correcting a note to `routine` removes it from the list through the category
 * filter alone.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { VoiceNoteUrgency } from './types';

export type OpenVoiceNoteProblem = {
  id: string;
  company_id: string;
  job_id: string;
  property_id: string | null;
  category: 'problem';
  urgency: VoiceNoteUrgency | null;
  reason: string | null;
  explanation: string | null;
  transcript: string | null;
  created_at: string;
  follow_up_status: 'open' | 'resolved' | null;
  last_reviewed_at: string | null;
};

export type DateRange = {
  from: string; // ISO
  to: string; // ISO
};

export type OpenProblemsRange = Partial<DateRange> & {
  /**
   * Skip the default 7-day window entirely (no created_at bounds unless `from`/`to` are given).
   * The KAN-153 carry-forward and office queue MUST use this form: an issue stays open until
   * someone resolves it, however old it is. The 7-day default is for digest-style callers only.
   */
  unbounded?: boolean;
};

export type OpenProblemsOptions = {
  /** Client to query with (defaults to the service-role client). Pass the user's client to keep RLS. */
  client?: SupabaseClient;
  /** Throw on query errors instead of returning [] (use where a schema error must not look empty). */
  throwOnError?: boolean;
};

/**
 * Returns voice notes whose effective category is `problem` and that are not resolved, for a
 * company. Defaults to the last 7 days; pass `{ unbounded: true }` to remove the window.
 */
export async function getOpenVoiceNoteProblems(
  companyId: string,
  range?: OpenProblemsRange,
  options: OpenProblemsOptions = {},
): Promise<OpenVoiceNoteProblem[]> {
  const client = options.client ?? supabaseAdmin;
  const unbounded = range?.unbounded === true;
  const to = range?.to ?? (unbounded ? null : new Date().toISOString());
  const from =
    range?.from ??
    (unbounded ? null : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

  let query = client
    .from('cadenza_job_voice_notes')
    .select(
      `
      id,
      company_id,
      job_id,
      property_id,
      category,
      urgency,
      model_reason,
      model_explanation,
      transcript,
      created_at,
      status,
      follow_up_status,
      last_reviewed_at
    `,
    )
    .eq('company_id', companyId)
    .eq('category', 'problem')
    .eq('status', 'done')
    // NULL follow_up_status (not yet backfilled) still counts as open.
    .or('follow_up_status.is.null,follow_up_status.neq.resolved');

  if (from) query = query.gte('created_at', from);
  if (to) query = query.lte('created_at', to);

  const { data, error } = await query.order('created_at', { ascending: false });

  if (error) {
    console.error('voice-notes: open problems query failed:', error.message);
    if (options.throwOnError) throw error;
    return [];
  }

  return (data ?? []).map((row) => ({
    id: String(row.id),
    company_id: String(row.company_id),
    job_id: String(row.job_id),
    property_id: row.property_id != null ? String(row.property_id) : null,
    category: 'problem' as const,
    urgency: (row.urgency as VoiceNoteUrgency | null) ?? null,
    reason: (row.model_reason as string | null) ?? null,
    explanation: (row.model_explanation as string | null) ?? null,
    transcript: (row.transcript as string | null) ?? null,
    created_at: String(row.created_at),
    follow_up_status: (row.follow_up_status as 'open' | 'resolved' | null) ?? null,
    last_reviewed_at: (row.last_reviewed_at as string | null) ?? null,
  }));
}

/**
 * Marks a note as an open follow-up when its effective category is `problem` and no status is
 * set yet. Runs as its own update (guarded by `follow_up_status IS NULL`) so classification
 * never fails on a database that has not received the KAN-153 migration yet.
 */
export async function markVoiceNoteProblemOpen(
  noteId: string,
  client: SupabaseClient = supabaseAdmin,
): Promise<void> {
  const { error } = await client
    .from('cadenza_job_voice_notes')
    .update({ follow_up_status: 'open' })
    .eq('id', noteId)
    .is('follow_up_status', null);

  if (error) {
    console.error('voice-notes: could not set follow_up_status:', noteId, error.message);
  }
}
