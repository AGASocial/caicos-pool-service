import { NextRequest, NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { entitlementError, hasEntitlement } from '@/lib/entitlements';
import { isRetryable, toApiStatus } from '@/lib/customer-reports/delivery-log-query';
import {
  isCustomerAutoReportsEnabled,
  processCustomerReportForJob,
} from '@/lib/customer-reports/process';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/report-deliveries/[id]/retry
 * Manually retry a failed / pending customer report. Records the acting user (KAN-152).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const { supabase, user } = await createAuthenticatedRouteClient();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CadenzaSupabaseClient;
  const { data: profile, error: profileError } = await client
    .from('cadenza_profiles')
    .select('company_id, role')
    .eq('id', user.id)
    .single();

  if (profileError || !profile?.company_id) {
    return NextResponse.json({ error: 'Company not found' }, { status: 403 });
  }
  if (!hasEntitlement(profile.role as string, 'report', 'edit')) {
    return NextResponse.json(entitlementError('report', 'edit'), { status: 403 });
  }
  const companyId = profile.company_id as string;

  if (!UUID_RE.test(id)) {
    return NextResponse.json({ error: 'Invalid delivery id' }, { status: 400 });
  }

  // Loaded through the caller's client (RLS) and filtered by company: other tenants → 404.
  const { data: delivery, error: loadError } = await client
    .from('customer_report_deliveries')
    .select('id, job_id, status, updated_at, created_at')
    .eq('id', id)
    .eq('company_id', companyId)
    .maybeSingle();

  if (loadError) {
    return NextResponse.json({ error: loadError.message }, { status: 500 });
  }
  if (!delivery) {
    return NextResponse.json({ error: 'Delivery not found' }, { status: 404 });
  }

  const status = delivery.status as string;
  if (status === 'queued' && !isRetryable(status, (delivery.updated_at ?? delivery.created_at) as string)) {
    return NextResponse.json(
      { error: 'A send attempt is already in progress', code: 'attempt_in_progress' },
      { status: 409 },
    );
  }
  if (!isRetryable(status, (delivery.updated_at ?? delivery.created_at) as string)) {
    return NextResponse.json(
      {
        error: 'Only failed or pending deliveries can be retried',
        code: 'not_retryable',
        status: toApiStatus(status),
      },
      { status: 409 },
    );
  }

  if (!isCustomerAutoReportsEnabled()) {
    return NextResponse.json(
      { error: 'Customer report emails are currently disabled', code: 'auto_send_disabled' },
      { status: 409 },
    );
  }

  let locale: string | null = null;
  try {
    const body = (await request.json()) as { locale?: unknown };
    if (typeof body?.locale === 'string') locale = body.locale;
  } catch {
    // body is optional
  }

  const result = await processCustomerReportForJob(delivery.job_id as string, {
    locale,
    companyId,
    actor: { source: 'retry', userId: user.id },
  });

  return NextResponse.json({
    id,
    status:
      result.status === 'already_processed'
        ? result.reason === 'skipped'
          ? 'skipped'
          : 'sent'
        : result.status,
    reason: result.reason ?? null,
    delivery_id: result.deliveryId ?? id,
  });
}
