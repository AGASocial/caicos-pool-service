import { NextResponse } from 'next/server';
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import type { CaicosSupabaseClient } from '@/lib/supabase-caicos';

export async function GET() {
  const { supabase, user } = await createAuthenticatedRouteClient();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const client = supabase as unknown as CaicosSupabaseClient;

  try {
    // Check if user has a Caicos profile (company_id)
    const { data: profile, error: profileError } = await client
      .from('caicos_profiles')
      .select('company_id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile?.company_id) {
      // No Caicos company: return zeros and empty lists
      return NextResponse.json({
        stats: {
          totalJobs: 0,
          totalRoutes: 0,
          totalTeamMembers: 0,
          totalProperties: 0,
        },
        completedJobs: [],
        pendingJobs: [],
      });
    }

    // Counts (RLS filters by company)
    const [jobsRes, routesRes, teamRes, propertiesRes] = await Promise.all([
      client.from('caicos_service_jobs').select('*', { count: 'exact', head: true }),
      client.from('caicos_routes').select('*', { count: 'exact', head: true }),
      client.from('caicos_profiles').select('*', { count: 'exact', head: true }),
      client.from('caicos_properties').select('*', { count: 'exact', head: true }),
    ]);

    const totalJobs = jobsRes.count ?? 0;
    const totalRoutes = routesRes.count ?? 0;
    const totalTeamMembers = teamRes.count ?? 0;
    const totalProperties = propertiesRes.count ?? 0;

    // Last 4 completed jobs and last 4 pending jobs (with property + technician)
    const jobSelect = `
      id,
      property_id,
      technician_id,
      scheduled_date,
      scheduled_time,
      status,
      created_at,
      property:caicos_properties!property_id(id, customer_name, address),
      technician:caicos_profiles!technician_id(id, full_name)
    `;

    const [completedRes, pendingRes] = await Promise.all([
      client
        .from('caicos_service_jobs')
        .select(jobSelect)
        .eq('status', 'completed')
        .order('created_at', { ascending: false })
        .limit(4),
      client
        .from('caicos_service_jobs')
        .select(jobSelect)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(4),
    ]);

    if (completedRes.error) {
      console.error('Dashboard fetch completed jobs:', completedRes.error);
    }
    if (pendingRes.error) {
      console.error('Dashboard fetch pending jobs:', pendingRes.error);
    }

    return NextResponse.json({
      stats: {
        totalJobs,
        totalRoutes,
        totalTeamMembers,
        totalProperties,
      },
      completedJobs: completedRes.data ?? [],
      pendingJobs: pendingRes.data ?? [],
    });
  } catch (e) {
    console.error('Dashboard API error:', e);
    return NextResponse.json({ error: 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
