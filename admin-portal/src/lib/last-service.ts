/**
 * KAN-155: last-service summary for shared properties (same company, more than one technician).
 *
 * The pure helpers (`pickLastService`, `toLastService`) have no database access so they can be
 * unit tested. `fetchLastService` reads through the caller's Supabase client (RLS applies) and
 * also filters every query by `company_id`. The payload is an allow-list: no voice notes,
 * follow-up notes, customer data, photos, or technician email ever leave this module.
 *
 * The technician app keeps a mirror of the picker in `technician-app/lib/lastServiceCore.ts`;
 * a unit test asserts both stay in sync.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingColumnError } from '@/lib/customer-reports/delivery-log';

/** Service event tags that matter for the last-service card. */
export const LAST_SERVICE_EVENT_TYPES = ['filter_cleaning', 'salt_addition'] as const;

/** Fallback label when the technician has no usable display name. */
export const GENERIC_TECHNICIAN_NAME = 'Technician';

/** Exact keys of the last-service payload (allow-list). */
export const LAST_SERVICE_FIELDS = [
  'job_id',
  'scheduled_date',
  'technician_name',
  'cleaned_filter',
  'backwashed',
  'salt_level',
  'service_event_types',
] as const;

export type LastService = {
  job_id: string;
  scheduled_date: string;
  technician_name: string;
  cleaned_filter: boolean;
  backwashed: boolean;
  salt_level: number | null;
  service_event_types: string[];
};

export type LastServiceResponse = {
  is_shared: boolean;
  last_service: LastService | null;
};

export type LastServiceJobRow = {
  id: string;
  scheduled_date: string;
  status?: string | null;
  is_deleted?: boolean | null;
};

export type LastServiceReportRow = {
  id?: string;
  job_id: string;
  technician_id?: string | null;
  created_at?: string | null;
  is_deleted?: boolean | null;
  cleaned_filter?: boolean | null;
  backwashed?: boolean | null;
  salt_level?: number | string | null;
  service_event_types?: string[] | null;
};

/** Thrown when the KAN-155 migration (is_shared column) has not been applied yet. */
export class LastServiceSchemaPendingError extends Error {
  readonly code = 'SCHEMA_PENDING';
  constructor(message = 'Shared-property schema is not available yet') {
    super(message);
    this.name = 'LastServiceSchemaPendingError';
  }
}

/** Display name for a technician: trimmed full name, never an email, generic fallback. */
export function technicianDisplayName(fullName: string | null | undefined): string {
  const name = fullName?.trim();
  if (!name || name.includes('@')) return GENERIC_TECHNICIAN_NAME;
  return name;
}

function toSaltLevel(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Builds the allow-listed payload from a job + report pair. Extra input fields are dropped. */
export function toLastService(
  job: LastServiceJobRow,
  report: LastServiceReportRow,
  technicianName: string | null | undefined,
): LastService {
  const eventTypes = (report.service_event_types ?? []).filter((t) =>
    (LAST_SERVICE_EVENT_TYPES as readonly string[]).includes(t),
  );
  return {
    job_id: job.id,
    scheduled_date: job.scheduled_date,
    technician_name: technicianDisplayName(technicianName),
    cleaned_filter: report.cleaned_filter === true,
    backwashed: report.backwashed === true,
    salt_level: toSaltLevel(report.salt_level),
    service_event_types: eventTypes,
  };
}

function isEligibleJob(job: LastServiceJobRow, currentJobId: string | null | undefined): boolean {
  return job.status === 'completed' && job.is_deleted !== true && job.id !== currentJobId;
}

/**
 * Picks the most recent completed visit: eligible job (completed, not deleted, not the current
 * job) with a non-deleted report, newest by `scheduled_date`, then report `created_at`.
 * Returns the chosen job/report pair or null.
 */
export function pickLastServicePair(
  jobs: LastServiceJobRow[],
  reports: LastServiceReportRow[],
  currentJobId?: string | null,
): { job: LastServiceJobRow; report: LastServiceReportRow } | null {
  const eligible = new Map(jobs.filter((j) => isEligibleJob(j, currentJobId)).map((j) => [j.id, j]));
  let best: { job: LastServiceJobRow; report: LastServiceReportRow } | null = null;

  for (const report of reports) {
    if (report.is_deleted === true) continue;
    const job = eligible.get(report.job_id);
    if (!job) continue;
    if (!best || isNewer({ job, report }, best)) best = { job, report };
  }
  return best;
}

function isNewer(
  a: { job: LastServiceJobRow; report: LastServiceReportRow },
  b: { job: LastServiceJobRow; report: LastServiceReportRow },
): boolean {
  if (a.job.scheduled_date !== b.job.scheduled_date) {
    return a.job.scheduled_date > b.job.scheduled_date;
  }
  return String(a.report.created_at ?? '') > String(b.report.created_at ?? '');
}

/** Pure picker + payload builder (no technician lookup). */
export function pickLastService(
  jobs: LastServiceJobRow[],
  reports: LastServiceReportRow[],
  options: { currentJobId?: string | null; technicianNames?: Record<string, string | null> } = {},
): LastService | null {
  const pair = pickLastServicePair(jobs, reports, options.currentJobId);
  if (!pair) return null;
  const techId = pair.report.technician_id;
  return toLastService(pair.job, pair.report, techId ? options.technicianNames?.[techId] : null);
}

/** Response for a property: summary only when the property is shared. */
export function buildLastServiceResponse(
  isShared: boolean,
  lastService: LastService | null,
): LastServiceResponse {
  return isShared ? { is_shared: true, last_service: lastService } : { is_shared: false, last_service: null };
}

type DbError = { code?: string; message?: string } | null | undefined;

function rethrow(error: NonNullable<DbError>, label: string): never {
  if (isMissingColumnError(error) || error.code === '42P01') throw new LastServiceSchemaPendingError();
  throw new Error(`${label}: ${error.message ?? 'query failed'}`);
}

/** Newest completed jobs considered per property (a shared house is visited weekly or so). */
const MAX_CANDIDATE_JOBS = 25;

const REPORT_FIELDS =
  'id, job_id, technician_id, created_at, is_deleted, cleaned_filter, backwashed, salt_level, service_event_types';

/**
 * Looks up the property in the caller's company. Returns null when it does not exist or belongs
 * to another company (the caller answers 404 in both cases).
 */
export async function loadSharedFlag(
  client: SupabaseClient,
  companyId: string,
  propertyId: string,
): Promise<boolean | null> {
  const { data, error } = await client
    .from('cadenza_properties')
    .select('id, is_shared')
    .eq('id', propertyId)
    .eq('company_id', companyId)
    .maybeSingle();
  if (error) rethrow(error, 'property lookup');
  if (!data) return null;
  return (data as { is_shared?: boolean | null }).is_shared === true;
}

/** Last completed visit at a property (same company), excluding `currentJobId`. */
export async function fetchLastService(
  client: SupabaseClient,
  companyId: string,
  propertyId: string,
  currentJobId?: string | null,
): Promise<LastService | null> {
  let jobQuery = client
    .from('cadenza_service_jobs')
    .select('id, scheduled_date, status, is_deleted')
    .eq('company_id', companyId)
    .eq('property_id', propertyId)
    .eq('status', 'completed')
    .eq('is_deleted', false);
  if (currentJobId) jobQuery = jobQuery.neq('id', currentJobId);

  const { data: jobData, error: jobError } = await jobQuery
    .order('scheduled_date', { ascending: false })
    .limit(MAX_CANDIDATE_JOBS);
  if (jobError) rethrow(jobError, 'last-service jobs');
  const jobs = (jobData ?? []) as unknown as LastServiceJobRow[];
  if (jobs.length === 0) return null;

  const { data: reportData, error: reportError } = await client
    .from('cadenza_service_reports')
    .select(REPORT_FIELDS)
    .eq('company_id', companyId)
    .eq('is_deleted', false)
    .in('job_id', jobs.map((j) => j.id));
  if (reportError) rethrow(reportError, 'last-service reports');

  const pair = pickLastServicePair(jobs, (reportData ?? []) as unknown as LastServiceReportRow[], currentJobId);
  if (!pair) return null;

  let technicianName: string | null = null;
  if (pair.report.technician_id) {
    const { data: profile } = await client
      .from('cadenza_profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .eq('id', pair.report.technician_id)
      .maybeSingle();
    technicianName = (profile as { full_name?: string | null } | null)?.full_name ?? null;
  }
  return toLastService(pair.job, pair.report, technicianName);
}
