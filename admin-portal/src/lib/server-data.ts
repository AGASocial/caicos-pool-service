import { createRouteClient } from '@/lib/supabase-server';
import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';
import { buildPaginatedResponse } from '@/lib/pagination';

/** Server-side data helpers for RSC pages (US-F-001). */

export type DashboardJob = {
  id: string;
  scheduled_date: string;
  scheduled_time: string | null;
  status: string;
  created_at: string;
  property: { id: string; customer_name: string; address: string } | null;
  technician: { id: string; full_name: string } | null;
  route: { id: string; name: string } | null;
};

type Relation<T> = T | T[] | null | undefined;

function firstRelation<T>(value: Relation<T>): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function normalizeDashboardJob(row: Record<string, unknown>): DashboardJob {
  return {
    id: row.id as string,
    scheduled_date: row.scheduled_date as string,
    scheduled_time: (row.scheduled_time as string | null) ?? null,
    status: row.status as string,
    created_at: row.created_at as string,
    property: firstRelation(row.property as Relation<DashboardJob['property']>),
    technician: firstRelation(row.technician as Relation<DashboardJob['technician']>),
    route: firstRelation(row.route as Relation<DashboardJob['route']>),
  };
}

export async function fetchDashboardServerData() {
  const supabase = await createRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const client = supabase as unknown as CadenzaSupabaseClient;
  const { data: profile } = await client
    .from('cadenza_profiles')
    .select('company_id')
    .eq('id', user.id)
    .single();

  if (!profile?.company_id) {
    return {
      stats: { totalJobs: 0, totalRoutes: 0, totalTeamMembers: 0, totalProperties: 0 },
      completedJobs: [],
      pendingJobs: [],
    };
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

  return {
    stats: {
      totalJobs: statsRow?.total_jobs ?? 0,
      totalRoutes: statsRow?.total_routes ?? 0,
      totalTeamMembers: statsRow?.total_team_members ?? 0,
      totalProperties: statsRow?.total_properties ?? 0,
    },
    completedJobs: (completedRes.data ?? []).map(normalizeDashboardJob),
    pendingJobs: (pendingRes.data ?? []).map(normalizeDashboardJob),
  };
}

export async function fetchPropertiesServerPage(limit = 50) {
  const supabase = await createRouteClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const client = supabase as unknown as CadenzaSupabaseClient;
  const { data } = await client
    .from('cadenza_properties')
    .select('id, customer_name, address, city, is_active, created_at')
    .eq('is_active', true)
    .order('customer_name', { ascending: true })
    .order('id', { ascending: true })
    .limit(limit + 1);

  const rows = data ?? [];
  return buildPaginatedResponse(
    rows as { id: string; customer_name: string }[],
    limit,
    (r) => `${r.customer_name}|${r.id}`,
  );
}
