/**
 * KAN-153 / KAN-154 hook: open voice-note problems by effective category.
 * Carry-forward / Monday digest tickets can consume this helper.
 */
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
};

export type DateRange = {
  from: string; // ISO
  to: string; // ISO
};

/**
 * Returns voice notes whose effective category is `problem` for a company
 * within an optional created_at range (defaults to last 7 days).
 */
export async function getOpenVoiceNoteProblems(
  companyId: string,
  range?: Partial<DateRange>,
): Promise<OpenVoiceNoteProblem[]> {
  const to = range?.to ?? new Date().toISOString();
  const from =
    range?.from ??
    new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
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
      status
    `,
    )
    .eq('company_id', companyId)
    .eq('category', 'problem')
    .eq('status', 'done')
    .gte('created_at', from)
    .lte('created_at', to)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('voice-notes: open problems query failed:', error.message);
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
  }));
}
