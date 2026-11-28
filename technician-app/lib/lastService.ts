import { supabase } from '@/lib/supabase';
import {
  pickLastServicePair,
  toLastService,
  type LastService,
  type LastServiceJobRow,
  type LastServiceReportRow,
} from '@/lib/lastServiceCore';

export * from '@/lib/lastServiceCore';

/** Newest completed jobs considered per property. */
const MAX_CANDIDATE_JOBS = 25;

const REPORT_FIELDS =
  'job_id, technician_id, created_at, is_deleted, cleaned_filter, backwashed, salt_level, service_event_types';

/**
 * Whether the property is marked shared. Fails closed: a query error (for example the column not
 * existing before the migration is applied) means "not shared", so the job screen never breaks.
 */
export async function fetchPropertyIsShared(propertyId: string, companyId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('cadenza_properties')
    .select('is_shared')
    .eq('id', propertyId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) return false;
  return (data as { is_shared?: boolean | null } | null)?.is_shared === true;
}

/**
 * Last completed visit at a shared property (same company), excluding the current job. Reads go
 * through the existing company-scoped RLS and every query also filters by company_id. Returns
 * null for non-shared properties and when no prior completed visit exists. Throws on query errors.
 */
export async function fetchLastService(params: {
  propertyId: string;
  companyId: string;
  currentJobId: string;
}): Promise<LastService | null> {
  const { propertyId, companyId, currentJobId } = params;

  if (!(await fetchPropertyIsShared(propertyId, companyId))) return null;

  const jobsRes = await supabase
    .from('cadenza_service_jobs')
    .select('id, scheduled_date, status, is_deleted')
    .eq('company_id', companyId)
    .eq('property_id', propertyId)
    .eq('status', 'completed')
    .eq('is_deleted', false)
    .neq('id', currentJobId)
    .order('scheduled_date', { ascending: false })
    .limit(MAX_CANDIDATE_JOBS);
  if (jobsRes.error) throw new Error(jobsRes.error.message);
  const jobs = (jobsRes.data ?? []) as unknown as LastServiceJobRow[];
  if (jobs.length === 0) return null;

  const reportsRes = await supabase
    .from('cadenza_service_reports')
    .select(REPORT_FIELDS)
    .eq('company_id', companyId)
    .eq('is_deleted', false)
    .in(
      'job_id',
      jobs.map((j) => j.id),
    );
  if (reportsRes.error) throw new Error(reportsRes.error.message);

  const pair = pickLastServicePair(
    jobs,
    (reportsRes.data ?? []) as unknown as LastServiceReportRow[],
    currentJobId,
  );
  if (!pair) return null;

  let technicianFullName: string | null = null;
  if (pair.report.technician_id) {
    const profileRes = await supabase
      .from('cadenza_profiles')
      .select('full_name')
      .eq('company_id', companyId)
      .eq('id', pair.report.technician_id)
      .maybeSingle();
    technicianFullName = (profileRes.data as { full_name?: string | null } | null)?.full_name ?? null;
  }
  return toLastService(pair.job, pair.report, technicianFullName);
}
