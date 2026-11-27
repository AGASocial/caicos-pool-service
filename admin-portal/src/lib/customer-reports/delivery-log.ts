import type { SupabaseClient } from '@supabase/supabase-js';

/** Stored statuses (KAN-151 CHECK). `queued` is shown to users as "pending". */
export type DeliveryStatus = 'queued' | 'sent' | 'failed' | 'skipped';

export type TriggerSource = 'auto' | 'manual' | 'retry';

/** Who triggered a send attempt. `userId` is null for the system / cron. */
export type DeliveryActor = { source: TriggerSource; userId: string | null };

export const AUTO_ACTOR: DeliveryActor = { source: 'auto', userId: null };

/** Automatic (cron / job-complete) attempts stop after this many tries; manual retry ignores it. */
export const MAX_AUTO_ATTEMPTS = 3;

/** A pending row younger than this is assumed to be mid-send and is not retryable. */
export const PENDING_RETRY_MIN_AGE_MS = 60_000;

const MAX_REASON_LENGTH = 500;

export type DeliveryRecordInput = {
  companyId: string;
  jobId: string;
  propertyId?: string | null;
  recipient: string | null;
  status: DeliveryStatus;
  reason?: string | null;
  providerMessageId?: string | null;
  actor?: DeliveryActor;
  attemptCount: number;
  now?: Date;
};

export type DeliveryRecord = {
  company_id: string;
  job_id: string;
  property_id: string | null;
  recipient: string | null;
  status: DeliveryStatus;
  reason: string | null;
  provider_message_id: string | null;
  trigger_source: TriggerSource;
  triggered_by: string | null;
  attempt_count: number;
  updated_at: string;
};

/** Truncate / normalize error details so a provider error can never bloat the log. */
export function normalizeReason(reason: string | null | undefined): string | null {
  if (reason == null) return null;
  const trimmed = String(reason).trim();
  if (!trimmed) return null;
  return trimmed.length > MAX_REASON_LENGTH ? `${trimmed.slice(0, MAX_REASON_LENGTH - 1)}…` : trimmed;
}

/** Pure: build the row written to `customer_report_deliveries`. */
export function buildDeliveryRecord(input: DeliveryRecordInput): DeliveryRecord {
  const actor = input.actor ?? AUTO_ACTOR;
  return {
    company_id: input.companyId,
    job_id: input.jobId,
    property_id: input.propertyId ?? null,
    recipient: input.recipient,
    status: input.status,
    // Error details only make sense for failed/skipped attempts; sent / pending clear them.
    reason:
      input.status === 'failed' || input.status === 'skipped'
        ? normalizeReason(input.reason)
        : null,
    provider_message_id: input.providerMessageId ?? null,
    trigger_source: actor.source,
    triggered_by: actor.source === 'auto' ? null : actor.userId,
    attempt_count: Math.max(1, Math.floor(input.attemptCount)),
    updated_at: (input.now ?? new Date()).toISOString(),
  };
}

/** Columns that exist before the KAN-152 migration. */
const LEGACY_KEYS = [
  'company_id',
  'job_id',
  'recipient',
  'status',
  'reason',
  'provider_message_id',
] as const;

export function toLegacyRecord(record: DeliveryRecord): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const key of LEGACY_KEYS) out[key] = record[key];
  return out;
}

/** True when PostgREST/Postgres complains about a column that does not exist yet (migration pending). */
export function isMissingColumnError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false;
  if (error.code === 'PGRST204' || error.code === '42703') return true;
  const message = error.message ?? '';
  return /column .* does not exist|could not find the .* column/i.test(message);
}

export type ExistingDelivery = {
  id: string;
  status: DeliveryStatus;
  attempt_count: number;
};

/** Latest delivery row for a job (any status), tolerant of the pre-migration schema. */
export async function loadLatestDelivery(
  client: SupabaseClient,
  jobId: string,
): Promise<ExistingDelivery | null> {
  const run = (columns: string) =>
    client
      .from('customer_report_deliveries')
      .select(columns)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

  let { data, error } = await run('id, status, attempt_count');
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await run('id, status'));
  }
  if (error || !data) return null;
  const row = data as unknown as { id: string; status: DeliveryStatus; attempt_count?: number };
  return {
    id: row.id,
    status: row.status,
    attempt_count: typeof row.attempt_count === 'number' ? row.attempt_count : 1,
  };
}

/**
 * Insert a new delivery row, or update the existing one in place (retry).
 * Falls back to the legacy column set when the KAN-152 migration is not applied yet,
 * so KAN-151 idempotency (delivery rows) keeps working in any deploy order.
 */
export async function saveDelivery(
  client: SupabaseClient,
  record: DeliveryRecord,
  existingId?: string,
): Promise<string | undefined> {
  if (existingId) {
    // company_id / job_id never change on update.
    const updatable: Record<string, unknown> = { ...record };
    delete updatable.company_id;
    delete updatable.job_id;
    let { error } = await client
      .from('customer_report_deliveries')
      .update(updatable)
      .eq('id', existingId);
    if (error && isMissingColumnError(error)) {
      const legacy = toLegacyRecord(record);
      delete legacy.company_id;
      delete legacy.job_id;
      ({ error } = await client
        .from('customer_report_deliveries')
        .update(legacy)
        .eq('id', existingId));
    }
    if (error) {
      console.error('customer-reports: failed to update delivery:', error.message);
      return undefined;
    }
    return existingId;
  }

  let { data, error } = await client
    .from('customer_report_deliveries')
    .insert(record)
    .select('id')
    .single();
  if (error && isMissingColumnError(error)) {
    ({ data, error } = await client
      .from('customer_report_deliveries')
      .insert(toLegacyRecord(record))
      .select('id')
      .single());
  }
  if (error) {
    console.error('customer-reports: failed to insert delivery:', error.message);
    return undefined;
  }
  return (data as { id?: string } | null)?.id;
}
