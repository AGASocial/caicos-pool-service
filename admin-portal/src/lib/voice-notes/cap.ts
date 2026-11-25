/**
 * Per-company monthly spend vs voice_notes_monthly_cap_usd.
 */
import { supabaseAdmin } from '@/lib/supabase-admin';

export type CapStatus = {
  companyId: string;
  monthToDateUsd: number;
  capUsd: number;
  overCap: boolean;
};

function monthStartUtc(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function getCompanyVoiceNotesCapStatus(
  companyId: string,
  now = new Date(),
): Promise<CapStatus> {
  const { data: company, error: companyErr } = await supabaseAdmin
    .from('cadenza_companies')
    .select('voice_notes_monthly_cap_usd')
    .eq('id', companyId)
    .maybeSingle();

  if (companyErr) {
    throw new Error(`Failed to load company cap: ${companyErr.message}`);
  }

  const capUsd = Number(company?.voice_notes_monthly_cap_usd ?? 5);

  const { data: rows, error } = await supabaseAdmin
    .from('cadenza_job_voice_notes')
    .select('cost_usd')
    .eq('company_id', companyId)
    .gte('created_at', monthStartUtc(now))
    .not('cost_usd', 'is', null);

  if (error) {
    throw new Error(`Failed to sum voice note costs: ${error.message}`);
  }

  const monthToDateUsd = (rows ?? []).reduce(
    (sum, row) => sum + Number(row.cost_usd ?? 0),
    0,
  );

  return {
    companyId,
    monthToDateUsd,
    capUsd,
    overCap: monthToDateUsd >= capUsd,
  };
}

/** Pure helper for unit tests. */
export function isOverMonthlyCap(monthToDateUsd: number, capUsd: number): boolean {
  return monthToDateUsd >= capUsd;
}
