/**
 * KAN-155 last-service summary (shared properties, same company): pure helpers with no React
 * Native / Supabase imports so they stay unit testable. Database access lives in `lastService.ts`.
 *
 * Mirrors `admin-portal/src/lib/last-service.ts` (same picker, same payload allow-list); a
 * unit test in the admin portal asserts both implementations agree.
 */

/** Service event tags that matter for the last-service card. */
export const LAST_SERVICE_EVENT_TYPES = ['filter_cleaning', 'salt_addition'] as const;

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
  /** Display name; `null` means "show the generic Technician label" (never an email). */
  technician_name: string | null;
  cleaned_filter: boolean;
  backwashed: boolean;
  salt_level: number | null;
  service_event_types: string[];
};

export type LastServiceJobRow = {
  id: string;
  scheduled_date: string;
  status?: string | null;
  is_deleted?: boolean | null;
};

export type LastServiceReportRow = {
  job_id: string;
  technician_id?: string | null;
  created_at?: string | null;
  is_deleted?: boolean | null;
  cleaned_filter?: boolean | null;
  backwashed?: boolean | null;
  salt_level?: number | string | null;
  service_event_types?: string[] | null;
};

/** Technician display name; emails and blanks become null (UI shows a generic label). */
export function safeTechnicianName(fullName: string | null | undefined): string | null {
  const name = fullName?.trim();
  if (!name || name.includes('@')) return null;
  return name;
}

function toSaltLevel(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Allow-listed payload from a job + report pair; any other field is dropped. */
export function toLastService(
  job: LastServiceJobRow,
  report: LastServiceReportRow,
  technicianFullName: string | null | undefined,
): LastService {
  return {
    job_id: job.id,
    scheduled_date: job.scheduled_date,
    technician_name: safeTechnicianName(technicianFullName),
    cleaned_filter: report.cleaned_filter === true,
    backwashed: report.backwashed === true,
    salt_level: toSaltLevel(report.salt_level),
    service_event_types: (report.service_event_types ?? []).filter((t) =>
      (LAST_SERVICE_EVENT_TYPES as readonly string[]).includes(t),
    ),
  };
}

type Pair = { job: LastServiceJobRow; report: LastServiceReportRow };

function isNewer(a: Pair, b: Pair): boolean {
  if (a.job.scheduled_date !== b.job.scheduled_date) return a.job.scheduled_date > b.job.scheduled_date;
  return String(a.report.created_at ?? '') > String(b.report.created_at ?? '');
}

/**
 * Most recent completed visit: job completed, not deleted, not the current job, with a
 * non-deleted report; newest by `scheduled_date`, then report `created_at`.
 */
export function pickLastServicePair(
  jobs: LastServiceJobRow[],
  reports: LastServiceReportRow[],
  currentJobId?: string | null,
): Pair | null {
  const eligible = new Map(
    jobs
      .filter((j) => j.status === 'completed' && j.is_deleted !== true && j.id !== currentJobId)
      .map((j) => [j.id, j]),
  );
  let best: Pair | null = null;
  for (const report of reports) {
    if (report.is_deleted === true) continue;
    const job = eligible.get(report.job_id);
    if (!job) continue;
    const candidate = { job, report };
    if (!best || isNewer(candidate, best)) best = candidate;
  }
  return best;
}

/** Whether the card should render: shared property and a prior completed visit exists. */
export function shouldShowLastService(
  isShared: boolean | null | undefined,
  lastService: LastService | null | undefined,
): lastService is LastService {
  return isShared === true && lastService != null;
}

/** Summary line pieces, so the screen only maps them to translated strings. */
export type LastServiceFacts = {
  cleanedFilter: boolean;
  backwashed: boolean;
  saltLevel: number | null;
};

export function lastServiceFacts(lastService: LastService): LastServiceFacts {
  const types = lastService.service_event_types;
  return {
    cleanedFilter: lastService.cleaned_filter || types.includes('filter_cleaning'),
    backwashed: lastService.backwashed,
    saltLevel: lastService.salt_level,
  };
}
