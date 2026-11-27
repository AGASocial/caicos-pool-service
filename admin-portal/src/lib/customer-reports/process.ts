import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { collectRecordedEvents, decideCustomerReport } from './decide';
import { sendCustomerReportEmail } from './mailer';
import {
  AUTO_ACTOR,
  MAX_AUTO_ATTEMPTS,
  buildDeliveryRecord,
  loadLatestDelivery,
  saveDelivery,
  type DeliveryActor,
  type DeliveryStatus,
} from './delivery-log';
import {
  DEFAULT_AUTO_SEND_EVENT_TYPES,
  parseAutoSendEventTypes,
} from './types';

export type ProcessCustomerReportResult = {
  status: 'sent' | 'failed' | 'skipped' | 'already_processed';
  reason?: string;
  deliveryId?: string;
  providerMessageId?: string | null;
};

/**
 * Decide + send (or skip) a customer report for a completed job.
 * Idempotent: if a terminal delivery already exists for the job, no-ops.
 * Uses service-role for delivery inserts so cron and tech-triggered paths work.
 */
export function isCustomerAutoReportsEnabled(): boolean {
  return process.env.CUSTOMER_AUTO_REPORTS_ENABLED?.trim().toLowerCase() === 'true';
}

export async function processCustomerReportForJob(
  jobId: string,
  opts?: {
    locale?: string | null;
    client?: SupabaseClient;
    /** Who triggered this attempt (default: system / automatic). */
    actor?: DeliveryActor;
    /** When set, the job must belong to this company (manual retry guard). */
    companyId?: string;
  },
): Promise<ProcessCustomerReportResult> {
  const readClient = opts?.client ?? supabaseAdmin;
  const actor = opts?.actor ?? AUTO_ACTOR;

  const existing = await loadLatestDelivery(supabaseAdmin, jobId);

  if (existing && (existing.status === 'sent' || existing.status === 'skipped')) {
    return {
      status: 'already_processed',
      reason: String(existing.status),
      deliveryId: existing.id,
    };
  }

  // Automatic retries stop after MAX_AUTO_ATTEMPTS; a manual retry is always allowed.
  if (
    actor.source === 'auto' &&
    existing?.status === 'failed' &&
    existing.attempt_count >= MAX_AUTO_ATTEMPTS
  ) {
    return { status: 'failed', reason: 'auto_retry_limit', deliveryId: existing.id };
  }

  const { data: job, error: jobErr } = await readClient
    .from('cadenza_service_jobs')
    .select(
      `
      id,
      company_id,
      property_id,
      status,
      scheduled_date,
      has_paid_extras,
      send_paid_extra_report,
      property:cadenza_properties!property_id(
        customer_name,
        customer_email,
        address
      ),
      technician:cadenza_profiles!technician_id(full_name),
      company:cadenza_companies!company_id(name)
    `,
    )
    .eq('id', jobId)
    .maybeSingle();

  if (jobErr || !job) {
    console.error('customer-reports: job load failed:', jobErr?.message);
    return { status: 'skipped', reason: 'job_not_found' };
  }

  if (opts?.companyId && job.company_id !== opts.companyId) {
    return { status: 'skipped', reason: 'job_not_found' };
  }

  if (job.status !== 'completed') {
    return { status: 'skipped', reason: 'job_not_completed' };
  }

  const companyId = job.company_id as string;
  const propertyId = (job.property_id as string | null) ?? null;
  const property = (Array.isArray(job.property) ? job.property[0] : job.property) as
    | { customer_name?: string; customer_email?: string | null; address?: string }
    | null;
  const technician = (Array.isArray(job.technician) ? job.technician[0] : job.technician) as
    | { full_name?: string }
    | null;
  const company = (Array.isArray(job.company) ? job.company[0] : job.company) as
    | { name?: string }
    | null;

  const { data: settingsRow } = await readClient
    .from('cadenza_customer_report_settings')
    .select('auto_send_event_types')
    .eq('company_id', companyId)
    .maybeSingle();

  const autoSendEventTypes = settingsRow?.auto_send_event_types
    ? parseAutoSendEventTypes(settingsRow.auto_send_event_types)
    : [...DEFAULT_AUTO_SEND_EVENT_TYPES];

  const { data: report } = await readClient
    .from('cadenza_service_reports')
    .select(
      `
      service_event_types,
      cleaned_filter,
      backwashed,
      other_chemicals,
      chlorine_added,
      acid_added,
      ph_level,
      chlorine_level,
      alkalinity,
      calcium_hardness,
      cyanuric_acid,
      salt_level
    `,
    )
    .eq('job_id', jobId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { recordedEventTypes, hasChemicalData } = collectRecordedEvents(
    report as Parameters<typeof collectRecordedEvents>[0],
  );

  const decision = decideCustomerReport({
    autoSendEventTypes,
    recordedEventTypes,
    hasChemicalData,
    hasPaidExtras: Boolean(job.has_paid_extras),
    sendPaidExtraReport: Boolean(job.send_paid_extra_report),
    customerEmail: property?.customer_email,
  });

  const recipient = property?.customer_email?.trim() || null;
  const nextAttempt = (existing?.attempt_count ?? 0) + 1;

  const record = (
    status: DeliveryStatus,
    extra: { reason?: string | null; providerMessageId?: string | null; attemptCount?: number } = {},
  ) =>
    buildDeliveryRecord({
      companyId,
      jobId,
      propertyId,
      recipient,
      status,
      reason: extra.reason,
      providerMessageId: extra.providerMessageId,
      actor,
      attemptCount: extra.attemptCount ?? nextAttempt,
    });

  if (decision.action === 'skip') {
    const deliveryId = await saveDelivery(
      supabaseAdmin,
      record('skipped', { reason: decision.reason }),
      existing?.id,
    );
    return { status: 'skipped', reason: decision.reason, deliveryId };
  }

  // Global kill switch: customer emails stay off until the owner explicitly
  // enables them (CUSTOMER_AUTO_REPORTS_ENABLED=true). Recorded as skipped so
  // jobs closed while disabled are never back-filled later.
  if (!isCustomerAutoReportsEnabled()) {
    const deliveryId = await saveDelivery(
      supabaseAdmin,
      record('skipped', { reason: 'auto_send_disabled' }),
      existing?.id,
    );
    return { status: 'skipped', reason: 'auto_send_disabled', deliveryId };
  }

  const scheduledDate =
    job.scheduled_date != null
      ? String(job.scheduled_date).slice(0, 10)
      : new Date().toISOString().slice(0, 10);

  // Record a pending row before sending so a crash mid-send is visible as "pending".
  const pendingId = await saveDelivery(supabaseAdmin, record('queued'), existing?.id);

  let sendResult: Awaited<ReturnType<typeof sendCustomerReportEmail>>;
  try {
    sendResult = await sendCustomerReportEmail({
      to: recipient!,
      locale: opts?.locale,
      customerName: property?.customer_name?.trim() || 'Customer',
      propertyAddress: property?.address?.trim() || 'your property',
      companyName: company?.name?.trim() || 'Your pool service company',
      scheduledDate,
      technicianName: technician?.full_name ?? null,
      eventsToReport: decision.eventsToReport,
      includePaidExtras: decision.includePaidExtras,
      idempotencyKey: `customer-report/${jobId}`,
    });
  } catch (err) {
    const reason = err instanceof Error ? err.message : 'send_failed';
    const deliveryId = await saveDelivery(
      supabaseAdmin,
      record('failed', { reason, attemptCount: nextAttempt }),
      pendingId ?? existing?.id,
    );
    return { status: 'failed', reason, deliveryId };
  }

  if (!sendResult.ok) {
    const reason = sendResult.skipped
      ? 'resend_api_key_missing'
      : sendResult.error || 'send_failed';
    const deliveryId = await saveDelivery(
      supabaseAdmin,
      record('failed', { reason, providerMessageId: sendResult.messageId }),
      pendingId ?? existing?.id,
    );
    return { status: 'failed', reason, deliveryId, providerMessageId: sendResult.messageId };
  }

  const deliveryId = await saveDelivery(
    supabaseAdmin,
    record('sent', { providerMessageId: sendResult.messageId }),
    pendingId ?? existing?.id,
  );

  return {
    status: 'sent',
    deliveryId,
    providerMessageId: sendResult.messageId,
  };
}

/**
 * Process completed jobs that still lack a terminal delivery row (tech-app path).
 */
export async function processPendingCustomerReports(limit = 50): Promise<{
  processed: number;
  results: ProcessCustomerReportResult[];
}> {
  const { data: completedJobs, error } = await supabaseAdmin
    .from('cadenza_service_jobs')
    .select('id')
    .eq('status', 'completed')
    .eq('is_deleted', false)
    .order('updated_at', { ascending: false })
    .limit(limit * 3);

  if (error || !completedJobs?.length) {
    if (error) console.error('customer-reports: pending scan failed:', error.message);
    return { processed: 0, results: [] };
  }

  const results: ProcessCustomerReportResult[] = [];
  let processed = 0;

  for (const row of completedJobs) {
    if (processed >= limit) break;
    const jobId = row.id as string;

    const prior = await loadLatestDelivery(supabaseAdmin, jobId);
    if (prior) {
      if (prior.status === 'sent' || prior.status === 'skipped') continue;
      // Auto-retry cap reached: leave for a manual retry from the delivery log.
      if (prior.status === 'failed' && prior.attempt_count >= MAX_AUTO_ATTEMPTS) continue;
    }

    const result = await processCustomerReportForJob(jobId);
    if (result.status !== 'already_processed') {
      results.push(result);
      processed += 1;
    }
  }

  return { processed, results };
}
