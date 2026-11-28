/**
 * KAN-153: server-side loader for open issues (open follow-up reports ∪ unresolved problem
 * voice notes). Reads go through the caller's Supabase client so RLS still applies; every query
 * is also filtered by company_id explicitly.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isMissingColumnError } from '@/lib/customer-reports/delivery-log';
import {
  carryForwardIssuesForJob,
  filterByMinDays,
  oldestDaysByJob,
  sortOldestFirst,
  unionOpenIssues,
  type OpenIssue,
  type OpenIssueReportInput,
} from '@/lib/follow-up-jobs';
import { getOpenVoiceNoteProblems } from '@/lib/voice-notes/open-problems';

/** Thrown when the KAN-153 migration has not been applied to the database yet. */
export class OpenIssuesSchemaPendingError extends Error {
  readonly code = 'SCHEMA_PENDING';
  constructor(message = 'Open-issue schema is not available yet') {
    super(message);
    this.name = 'OpenIssuesSchemaPendingError';
  }
}

type DbError = { code?: string; message?: string } | null | undefined;

export function isOpenIssuesSchemaPending(error: DbError): boolean {
  return Boolean(error) && (isMissingColumnError(error) || error?.code === '42P01' || error?.code === '42883');
}

function rethrow(error: NonNullable<DbError>, label: string): never {
  if (isOpenIssuesSchemaPending(error)) throw new OpenIssuesSchemaPendingError();
  throw new Error(`${label}: ${error.message ?? 'query failed'}`);
}

type JobRef = {
  id: string;
  property_id: string | null;
  technician_id?: string | null;
  is_deleted?: boolean | null;
};

type Relation<T> = T | T[] | null | undefined;

function firstRelation<T>(value: Relation<T>): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

const JOB_ID_CHUNK = 150;

async function loadJobRefs(
  client: SupabaseClient,
  companyId: string,
  jobIds: string[],
): Promise<Map<string, JobRef>> {
  const refs = new Map<string, JobRef>();
  for (let i = 0; i < jobIds.length; i += JOB_ID_CHUNK) {
    const chunk = jobIds.slice(i, i + JOB_ID_CHUNK);
    const { data, error } = await client
      .from('cadenza_service_jobs')
      .select('id, property_id, technician_id, is_deleted')
      .eq('company_id', companyId)
      .in('id', chunk);
    if (error) rethrow(error, 'open-issues jobs');
    for (const row of data ?? []) {
      refs.set(String(row.id), {
        id: String(row.id),
        property_id: row.property_id != null ? String(row.property_id) : null,
        technician_id: row.technician_id != null ? String(row.technician_id) : null,
        is_deleted: row.is_deleted as boolean | null,
      });
    }
  }
  return refs;
}

/**
 * All open issues for a company, oldest first, each with `days_open`.
 * Voice notes use the unbounded helper form: an issue stays open until someone resolves it.
 */
export async function fetchOpenIssues(
  client: SupabaseClient,
  companyId: string,
  options: { now?: Date } = {},
): Promise<OpenIssue[]> {
  const now = options.now ?? new Date();

  const { data: reportRows, error: reportErr } = await client
    .from('cadenza_service_reports')
    .select(
      `id, job_id, follow_up_needed, issue_categories, follow_up_status, follow_up_notes,
       created_at, last_reviewed_at,
       job:cadenza_service_jobs!job_id(id, property_id, technician_id, is_deleted)`,
    )
    .eq('company_id', companyId)
    .eq('follow_up_status', 'open')
    .eq('is_deleted', false)
    .or('follow_up_needed.eq.true,issue_categories.neq.{}');

  if (reportErr) rethrow(reportErr, 'open-issues reports');

  const liveReports: OpenIssueReportInput[] = [];
  /** Origin job -> technician (KAN-154: the digest and office screen group by it). */
  const technicianByJob = new Map<string, string | null>();
  for (const row of reportRows ?? []) {
    const record = row as Record<string, unknown>;
    const job = firstRelation(record.job as Relation<JobRef>);
    if (!job || job.is_deleted) continue;
    technicianByJob.set(String(record.job_id), job.technician_id != null ? String(job.technician_id) : null);
    liveReports.push({
      id: String(record.id),
      job_id: String(record.job_id),
      property_id: job.property_id != null ? String(job.property_id) : null,
      created_at: String(record.created_at),
      follow_up_needed: record.follow_up_needed as boolean | null,
      issue_categories: record.issue_categories as string[] | null,
      follow_up_status: record.follow_up_status as string | null,
      follow_up_notes: record.follow_up_notes as string | null,
      last_reviewed_at: (record.last_reviewed_at as string | null) ?? null,
    });
  }

  let notes: Awaited<ReturnType<typeof getOpenVoiceNoteProblems>>;
  try {
    notes = await getOpenVoiceNoteProblems(companyId, { unbounded: true }, { client, throwOnError: true });
  } catch (error) {
    rethrow(error as NonNullable<DbError>, 'open-issues voice notes');
  }

  const noteJobIds = [...new Set(notes.map((n) => n.job_id))];
  const jobRefs = noteJobIds.length > 0 ? await loadJobRefs(client, companyId, noteJobIds) : new Map();

  const liveNotes = notes
    .map((note) => {
      const job = jobRefs.get(note.job_id);
      if (!job || job.is_deleted) return null;
      technicianByJob.set(note.job_id, job.technician_id ?? null);
      return {
        ...note,
        property_id: note.property_id ?? job.property_id,
        reason: note.reason,
      };
    })
    .filter((n): n is NonNullable<typeof n> => n !== null);

  const issues = unionOpenIssues(liveReports, liveNotes, now);
  return attachTechnicians(client, companyId, issues, technicianByJob);
}

/**
 * Adds origin-job technician id and display name to each issue. A job without a technician (or a
 * technician whose profile cannot be read) leaves both fields null: the "unassigned" bucket.
 */
async function attachTechnicians(
  client: SupabaseClient,
  companyId: string,
  issues: OpenIssue[],
  technicianByJob: Map<string, string | null>,
): Promise<OpenIssue[]> {
  const technicianIds = [...new Set([...technicianByJob.values()].filter((id): id is string => !!id))];
  const names = new Map<string, string>();
  for (let i = 0; i < technicianIds.length; i += JOB_ID_CHUNK) {
    const { data, error } = await client
      .from('cadenza_profiles')
      .select('id, full_name')
      .eq('company_id', companyId)
      .in('id', technicianIds.slice(i, i + JOB_ID_CHUNK));
    if (error) rethrow(error, 'open-issues technicians');
    for (const row of data ?? []) {
      const name = typeof row.full_name === 'string' ? row.full_name.trim() : '';
      if (name) names.set(String(row.id), name);
    }
  }
  return issues.map((issue) => {
    const technicianId = technicianByJob.get(issue.job_id) ?? null;
    return {
      ...issue,
      technician_id: technicianId,
      technician_name: technicianId ? (names.get(technicianId) ?? null) : null,
    };
  });
}

/** Issues to carry onto `job`: same property, origin job is a different job. */
export async function fetchCarryForwardIssues(
  client: SupabaseClient,
  companyId: string,
  job: { id: string; property_id: string | null },
  options: { now?: Date } = {},
): Promise<OpenIssue[]> {
  if (!job.property_id) return [];
  const issues = await fetchOpenIssues(client, companyId, options);
  return carryForwardIssuesForJob(issues, job);
}

export type OpenIssueQueueEntry = {
  job_id: string;
  days_open: number;
  issues: OpenIssue[];
};

/**
 * Queue view used by the dashboard and Jobs list: issues grouped by origin job, filtered by
 * the oldest issue's age, oldest group first.
 */
export function buildJobQueue(issues: OpenIssue[], minDays = 0): OpenIssueQueueEntry[] {
  const oldest = oldestDaysByJob(issues);
  const byJob = new Map<string, OpenIssue[]>();
  for (const issue of sortOldestFirst(issues)) {
    const list = byJob.get(issue.job_id);
    if (list) list.push(issue);
    else byJob.set(issue.job_id, [issue]);
  }
  const entries = [...byJob.entries()].map(([job_id, list]) => ({
    job_id,
    days_open: oldest.get(job_id) ?? 0,
    issues: list,
  }));
  return filterByMinDays(entries, minDays).sort((a, b) => b.days_open - a.days_open);
}

export type PropertyIdentity = { id: string; customer_name: string; address: string };

/** Property name / address for the issues' properties, scoped to the company. */
export async function fetchPropertiesForIssues(
  client: SupabaseClient,
  companyId: string,
  issues: Array<{ property_id: string | null }>,
): Promise<Map<string, PropertyIdentity>> {
  const properties = new Map<string, PropertyIdentity>();
  const propertyIds = [...new Set(issues.map((i) => i.property_id).filter((id): id is string => !!id))];
  for (let i = 0; i < propertyIds.length; i += JOB_ID_CHUNK) {
    const { data: rows, error } = await client
      .from('cadenza_properties')
      .select('id, customer_name, address')
      .eq('company_id', companyId)
      .in('id', propertyIds.slice(i, i + JOB_ID_CHUNK));
    if (error) rethrow(error, 'open-issues properties');
    for (const row of rows ?? []) {
      properties.set(String(row.id), {
        id: String(row.id),
        customer_name: String(row.customer_name),
        address: String(row.address ?? ''),
      });
    }
  }
  return properties;
}
