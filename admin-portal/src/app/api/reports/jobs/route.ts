import { NextRequest, NextResponse } from 'next/server';
import { withApiTiming } from '@/lib/api-timing';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { entitlementError, hasEntitlement } from '@/lib/entitlements';

type ReportStats = {
  total: number;
  byStatus: Record<string, number>;
  completionRate: number;
  byTechnician: Array<{
    technicianId: string;
    fullName: string;
    total: number;
    completed: number;
  }>;
};

export async function GET(request: NextRequest) {
  return withApiTiming('GET /api/reports/jobs', async () => {
    const { supabase, user } = await createAuthenticatedRouteClient();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: profile, error: profileError } = await (supabase as unknown as CadenzaSupabaseClient)
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

    const { data, error } = await (supabase as unknown as CadenzaSupabaseClient).rpc(
      'get_job_report_stats',
      {
        p_company_id: profile.company_id,
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
      },
    );

    if (error) {
      console.error('Error fetching job report stats:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const stats = data as ReportStats;
    return NextResponse.json(stats);
  });
}
