import type { DeliveryStatus, TriggerSource } from './delivery-log';
import { PENDING_RETRY_MIN_AGE_MS } from './delivery-log';

/** Status groups accepted by the log API / UI tabs. */
export const STATUS_GROUPS = ['all', 'unsent', 'sent', 'failed', 'pending', 'skipped'] as const;
export type StatusGroup = (typeof STATUS_GROUPS)[number];

/** Status values shown to users (`queued` is displayed as `pending`). */
export type ApiDeliveryStatus = 'sent' | 'failed' | 'pending' | 'skipped';

export const DEFAULT_LOG_PAGE_SIZE = 25;
export const MAX_LOG_PAGE_SIZE = 100;
/** Max property ids resolved from a text search before filtering deliveries. */
export const MAX_SEARCH_PROPERTY_IDS = 200;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function parseStatusGroup(raw: string | null | undefined): StatusGroup {
  const value = raw?.trim().toLowerCase();
  return (STATUS_GROUPS as readonly string[]).includes(value ?? '')
    ? (value as StatusGroup)
    : 'all';
}

/** Stored statuses matching a group; `null` means no status filter. */
export function dbStatusesForGroup(group: StatusGroup): DeliveryStatus[] | null {
  switch (group) {
    case 'unsent':
      return ['queued', 'failed'];
    case 'pending':
      return ['queued'];
    case 'sent':
      return ['sent'];
    case 'failed':
      return ['failed'];
    case 'skipped':
      return ['skipped'];
    default:
      return null;
  }
}

export function toApiStatus(status: string): ApiDeliveryStatus {
  if (status === 'queued') return 'pending';
  if (status === 'sent' || status === 'failed' || status === 'skipped') return status;
  return 'pending';
}

export function isUnsentStatus(status: string): boolean {
  return status === 'queued' || status === 'failed';
}

export type DeliveryLogQuery = {
  group: StatusGroup;
  q: string | null;
  propertyId: string | null;
  jobId: string | null;
  dateFrom: string | null;
  dateTo: string | null;
  page: number;
  limit: number;
};

export type DeliveryLogQueryResult =
  | { ok: true; query: DeliveryLogQuery }
  | { ok: false; error: string };

/** Remove characters that carry meaning in PostgREST filter strings / LIKE patterns. */
export function sanitizeSearchTerm(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    .replace(/[,()*%_\\"'`]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
  return cleaned || null;
}

export function parseDeliveryLogQuery(searchParams: URLSearchParams): DeliveryLogQueryResult {
  const propertyId = searchParams.get('property_id')?.trim() || null;
  if (propertyId && !UUID_RE.test(propertyId)) {
    return { ok: false, error: 'property_id must be a UUID' };
  }
  const jobId = searchParams.get('job_id')?.trim() || null;
  if (jobId && !UUID_RE.test(jobId)) {
    return { ok: false, error: 'job_id must be a UUID' };
  }

  const dateFrom = searchParams.get('date_from')?.trim() || null;
  const dateTo = searchParams.get('date_to')?.trim() || null;
  for (const [name, value] of [
    ['date_from', dateFrom],
    ['date_to', dateTo],
  ] as const) {
    if (value && (!DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)))) {
      return { ok: false, error: `${name} must be YYYY-MM-DD` };
    }
  }
  if (dateFrom && dateTo && dateFrom > dateTo) {
    return { ok: false, error: 'date_from must be on or before date_to' };
  }

  const rawLimit = Number(searchParams.get('limit') ?? DEFAULT_LOG_PAGE_SIZE);
  const limit = Number.isFinite(rawLimit)
    ? Math.min(Math.max(1, Math.floor(rawLimit)), MAX_LOG_PAGE_SIZE)
    : DEFAULT_LOG_PAGE_SIZE;
  const rawPage = Number(searchParams.get('page') ?? 1);
  const page = Number.isFinite(rawPage) ? Math.max(1, Math.floor(rawPage)) : 1;

  return {
    ok: true,
    query: {
      group: parseStatusGroup(searchParams.get('status')),
      q: sanitizeSearchTerm(searchParams.get('q')),
      propertyId,
      jobId,
      dateFrom,
      dateTo,
      page,
      limit,
    },
  };
}

/** Inclusive date range → [gte, lt) ISO timestamps on `created_at` (UTC days). */
export function dateRangeBounds(
  dateFrom: string | null,
  dateTo: string | null,
): { gte: string | null; lt: string | null } {
  const gte = dateFrom ? `${dateFrom}T00:00:00.000Z` : null;
  let lt: string | null = null;
  if (dateTo) {
    const end = new Date(`${dateTo}T00:00:00.000Z`);
    end.setUTCDate(end.getUTCDate() + 1);
    lt = end.toISOString();
  }
  return { gte, lt };
}

/** The subset of the Supabase filter builder used by the log (makes filters unit-testable). */
export interface DeliveryFilterChain {
  eq(column: string, value: string): DeliveryFilterChain;
  in(column: string, values: string[]): DeliveryFilterChain;
  gte(column: string, value: string): DeliveryFilterChain;
  lt(column: string, value: string): DeliveryFilterChain;
  or(filters: string): DeliveryFilterChain;
}

/**
 * Apply company scope + filters. `searchPropertyIds` are the company's properties whose
 * name/address matched `q` (resolved by the caller); `q` also matches the recipient email.
 */
export function applyDeliveryLogFilters(
  builder: DeliveryFilterChain,
  companyId: string,
  query: DeliveryLogQuery,
  searchPropertyIds: string[] = [],
): DeliveryFilterChain {
  let b = builder.eq('company_id', companyId);

  const statuses = dbStatusesForGroup(query.group);
  if (statuses) b = b.in('status', statuses);
  if (query.propertyId) b = b.eq('property_id', query.propertyId);
  if (query.jobId) b = b.eq('job_id', query.jobId);

  const { gte, lt } = dateRangeBounds(query.dateFrom, query.dateTo);
  if (gte) b = b.gte('created_at', gte);
  if (lt) b = b.lt('created_at', lt);

  if (query.q) {
    const parts = [`recipient.ilike.%${query.q}%`];
    const ids = searchPropertyIds.filter((id) => UUID_RE.test(id));
    if (ids.length) parts.push(`property_id.in.(${ids.join(',')})`);
    b = b.or(parts.join(','));
  }
  return b;
}

export type DeliveryRow = {
  id: string;
  job_id: string;
  property_id?: string | null;
  recipient: string | null;
  status: string;
  reason: string | null;
  attempt_count?: number | null;
  trigger_source?: TriggerSource | string | null;
  triggered_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  job?: unknown;
  property?: unknown;
  actor?: unknown;
};

export type DeliveryActorView = {
  type: 'system' | 'user';
  user_id: string | null;
  name: string | null;
};

export type DeliveryLogEntry = {
  id: string;
  status: ApiDeliveryStatus;
  recipient: string | null;
  reason: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
  job: { id: string; scheduled_date: string | null; status: string | null };
  property: {
    id: string;
    customer_name: string | null;
    address: string | null;
    city: string | null;
  } | null;
  actor: DeliveryActorView;
  can_retry: boolean;
};

function one<T>(value: unknown): T | null {
  if (Array.isArray(value)) return (value[0] as T) ?? null;
  return (value as T) ?? null;
}

export function formatActor(row: Pick<DeliveryRow, 'trigger_source' | 'triggered_by' | 'actor'>): DeliveryActorView {
  const source = row.trigger_source ?? 'auto';
  if (source === 'auto' || !row.triggered_by) {
    return { type: 'system', user_id: null, name: null };
  }
  const profile = one<{ full_name?: string | null }>(row.actor);
  return { type: 'user', user_id: row.triggered_by, name: profile?.full_name ?? null };
}

/** A failed row is always retryable; a pending row only once it is old enough not to be mid-send. */
export function isRetryable(status: string, updatedAt: string | null | undefined, now: Date = new Date()): boolean {
  if (status === 'failed') return true;
  if (status !== 'queued') return false;
  const updated = updatedAt ? Date.parse(updatedAt) : NaN;
  if (Number.isNaN(updated)) return true;
  return now.getTime() - updated >= PENDING_RETRY_MIN_AGE_MS;
}

export function mapDeliveryRow(row: DeliveryRow, now: Date = new Date()): DeliveryLogEntry {
  const job = one<{ id?: string; scheduled_date?: string | null; status?: string | null }>(row.job);
  const property = one<{
    id?: string;
    customer_name?: string | null;
    address?: string | null;
    city?: string | null;
  }>(row.property);
  const updatedAt = row.updated_at ?? row.created_at;

  return {
    id: row.id,
    status: toApiStatus(row.status),
    recipient: row.recipient ?? null,
    reason: row.reason ?? null,
    attempt_count: row.attempt_count ?? 1,
    created_at: row.created_at,
    updated_at: updatedAt,
    job: {
      id: job?.id ?? row.job_id,
      scheduled_date: job?.scheduled_date ?? null,
      status: job?.status ?? null,
    },
    property:
      property?.id || row.property_id
        ? {
            id: property?.id ?? (row.property_id as string),
            customer_name: property?.customer_name ?? null,
            address: property?.address ?? null,
            city: property?.city ?? null,
          }
        : null,
    actor: formatActor(row),
    can_retry: isRetryable(row.status, updatedAt, now),
  };
}
