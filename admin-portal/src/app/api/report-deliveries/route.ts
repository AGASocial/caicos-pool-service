import { NextRequest, NextResponse } from 'next/server';
import { withApiTiming } from '@/lib/api-timing';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { entitlementError, hasEntitlement } from '@/lib/entitlements';
import { isMissingColumnError } from '@/lib/customer-reports/delivery-log';
import {
  MAX_SEARCH_PROPERTY_IDS,
  applyDeliveryLogFilters,
  mapDeliveryRow,
  parseDeliveryLogQuery,
  type DeliveryFilterChain,
  type DeliveryRow,
} from '@/lib/customer-reports/delivery-log-query';

const DELIVERY_SELECT = `
  id,
  job_id,
  property_id,
  recipient,
  status,
  reason,
  attempt_count,
  trigger_source,
  triggered_by,
  created_at,
  updated_at,
  job:cadenza_service_jobs!job_id(id, scheduled_date, status),
  property:cadenza_properties!property_id(id, customer_name, address, city),
  actor:cadenza_profiles!triggered_by(full_name)
`;

function isSchemaPending(error: { code?: string; message?: string } | null): boolean {
  return Boolean(error) && (isMissingColumnError(error) || error?.code === '42P01');
}

/**
 * GET /api/report-deliveries
 * Company-scoped customer report delivery log (KAN-152).
 * Query: status (all|unsent|sent|failed|pending|skipped), q, property_id, job_id,
 *        date_from, date_to (YYYY-MM-DD), page, limit.
 */
export async function GET(request: NextRequest) {
  return withApiTiming('GET /api/report-deliveries', async () => {
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
    if (!hasEntitlement(profile.role as string, 'report', 'view')) {
      return NextResponse.json(entitlementError('report', 'view'), { status: 403 });
    }
    const companyId = profile.company_id as string;

    const parsed = parseDeliveryLogQuery(new URL(request.url).searchParams);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const query = parsed.query;

    // Text search: matching properties (name / address / city) in this company, plus recipient.
    let searchPropertyIds: string[] = [];
    if (query.q) {
      const { data: matches, error: matchError } = await client
        .from('cadenza_properties')
        .select('id')
        .eq('company_id', companyId)
        .or(
          `customer_name.ilike.%${query.q}%,address.ilike.%${query.q}%,city.ilike.%${query.q}%`,
        )
        .limit(MAX_SEARCH_PROPERTY_IDS);
      if (matchError) {
        console.error('GET /api/report-deliveries property search failed:', matchError.message);
        return NextResponse.json({ error: matchError.message }, { status: 500 });
      }
      searchPropertyIds = (matches ?? []).map((row) => row.id as string);
    }

    const from = (query.page - 1) * query.limit;
    const to = from + query.limit - 1;

    const base = client
      .from('customer_report_deliveries')
      .select(DELIVERY_SELECT, { count: 'exact' });
    const filtered = applyDeliveryLogFilters(
      base as unknown as DeliveryFilterChain,
      companyId,
      query,
      searchPropertyIds,
    ) as unknown as typeof base;

    const { data, error, count } = await filtered
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, to);

    if (error) {
      if (isSchemaPending(error)) {
        return NextResponse.json(
          { error: 'Delivery log schema is not available yet', code: 'SCHEMA_PENDING' },
          { status: 503 },
        );
      }
      console.error('GET /api/report-deliveries failed:', error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Badge for the Unsent tab: independent of the other filters, still company scoped.
    const { count: unsentCount } = await client
      .from('customer_report_deliveries')
      .select('id', { count: 'exact', head: true })
      .eq('company_id', companyId)
      .in('status', ['queued', 'failed']);

    const now = new Date();
    const total = count ?? (data ?? []).length;
    return NextResponse.json({
      data: ((data ?? []) as unknown as DeliveryRow[]).map((row) => mapDeliveryRow(row, now)),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        hasMore: from + (data ?? []).length < total,
      },
      unsent_count: unsentCount ?? 0,
    });
  });
}
