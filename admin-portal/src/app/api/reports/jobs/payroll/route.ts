/**
 * GET /api/reports/jobs/payroll?date_from=YYYY-MM-DD&date_to=YYYY-MM-DD[&format=csv|json]
 *
 * Payroll export: per-technician completed pools for a date range.
 * Same auth/entitlement as /api/reports/jobs; totals come from get_job_report_stats,
 * detail rows from an RLS-scoped query on the admin's company.
 */
import { NextRequest, NextResponse } from 'next/server';
import { withApiTiming } from '@/lib/api-timing';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { entitlementError, hasEntitlement } from '@/lib/entitlements';
import {
  buildPayrollCsv,
  isValidDate,
  mapPayrollRows,
  type PayrollTechSummary,
} from '@/lib/payroll-export';

const MAX_RANGE_DAYS = 93;
const PAGE = 1000;
const MAX_ROWS = 50_000;

const PAYROLL_SELECT = `
  id, scheduled_date, updated_at, technician_id,
  technician:cadenza_profiles!technician_id ( full_name ),
  property:cadenza_properties ( customer_name, address, city, state, zip ),
  reports:cadenza_service_reports ( departure_time, is_deleted )
`;

type StatsTech = { technicianId: string; fullName: string; total: number; completed: number };

export async function GET(request: NextRequest) {
  return withApiTiming('GET /api/reports/jobs/payroll', async () => {
    const { supabase, user } = await createAuthenticatedRouteClient();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const client = supabase as unknown as CadenzaSupabaseClient;
    const { data: profile, error: profileError } = await client
      .from('cadenza_profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .single();
    if (profileError || !profile?.company_id) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }
    if (!hasEntitlement(profile.role as string, 'report', 'view')) {
      return NextResponse.json(entitlementError('report', 'view'), { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const format = searchParams.get('format') === 'json' ? 'json' : 'csv';
    if (!isValidDate(dateFrom) || !isValidDate(dateTo) || dateFrom > dateTo) {
      return NextResponse.json({ error: 'date_from and date_to (YYYY-MM-DD, from <= to) are required' }, { status: 400 });
    }
    const spanDays = (Date.parse(dateTo) - Date.parse(dateFrom)) / 86_400_000;
    if (spanDays > MAX_RANGE_DAYS) {
      return NextResponse.json({ error: `Date range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
    }
    const companyId = profile.company_id as string;

    const { data: stats, error: statsError } = await client.rpc('get_job_report_stats', {
      p_company_id: companyId,
      p_date_from: dateFrom,
      p_date_to: dateTo,
    });
    if (statsError) {
      console.error('payroll: stats error', statsError);
      return NextResponse.json({ error: statsError.message }, { status: 500 });
    }
    const summary: PayrollTechSummary[] = ((stats as { byTechnician?: StatsTech[] })?.byTechnician ?? [])
      .filter((t) => t.completed > 0)
      .map((t) => ({ technicianId: t.technicianId, fullName: t.fullName, completed: t.completed }));

    const jobs: Record<string, unknown>[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE) {
      const { data, error } = await client
        .from('cadenza_service_jobs')
        .select(PAYROLL_SELECT)
        .eq('company_id', companyId)
        .eq('status', 'completed')
        .eq('is_deleted', false)
        .gte('scheduled_date', dateFrom)
        .lte('scheduled_date', dateTo)
        .not('technician_id', 'is', null)
        .order('scheduled_date', { ascending: true })
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error('payroll: jobs error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      const page = (data ?? []) as Record<string, unknown>[];
      jobs.push(...page);
      if (page.length < PAGE) break;
    }

    const rows = mapPayrollRows(jobs as Parameters<typeof mapPayrollRows>[0]);
    const tz = searchParams.get('tz') || 'America/Chicago';
    let safeTz = 'America/Chicago';
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: tz });
      safeTz = tz;
    } catch {
      /* fall back */
    }

    if (format === 'json') {
      return NextResponse.json({ dateFrom, dateTo, rows, summary });
    }
    const csv = buildPayrollCsv(rows, summary, safeTz);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="payroll_${dateFrom}_${dateTo}.csv"`,
        'Cache-Control': 'no-store',
      },
    });
  });
}
