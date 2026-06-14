import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { withApiTiming } from '@/lib/api-timing';

export async function GET() {
  return withApiTiming('GET /api/dashboard', async () => {
    const { supabase, user } = await createAuthenticatedRouteClient();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const client = supabase as unknown as CadenzaSupabaseClient;

    const { data: profile, error: profileError } = await client
      .from('cadenza_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      return NextResponse.json({
        stats: { totalJobs: 0, totalRoutes: 0, totalTeamMembers: 0, totalProperties: 0 },
        completedJobs: [],
        pendingJobs: [],
      });
    }

    const { data: statsRow } = await client
      .from('cadenza_company_stats')
      .select('total_jobs, total_routes, total_team_members, total_properties')
      .eq('company_id', profile.company_id)
      .maybeSingle();

    const jobSelect = `
      id, property_id, technician_id, route_id, scheduled_date, scheduled_time, status, created_at,
      property:cadenza_properties!property_id(id, customer_name, address),
      technician:cadenza_profiles!technician_id(id, full_name),
      route:cadenza_routes!route_id(id, name)
    `;

    const [completedRes, pendingRes] = await Promise.all([
      client.from('cadenza_service_jobs').select(jobSelect).eq('status', 'completed')
        .order('created_at', { ascending: false }).limit(4),
      client.from('cadenza_service_jobs').select(jobSelect).eq('status', 'pending')
        .order('created_at', { ascending: false }).limit(4),
    ]);

    return NextResponse.json({
      stats: {
        totalJobs: statsRow?.total_jobs ?? 0,
        totalRoutes: statsRow?.total_routes ?? 0,
        totalTeamMembers: statsRow?.total_team_members ?? 0,
        totalProperties: statsRow?.total_properties ?? 0,
      },
      completedJobs: completedRes.data ?? [],
      pendingJobs: pendingRes.data ?? [],
    });
  });
}
