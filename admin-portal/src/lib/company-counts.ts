import type { CadenzaSupabaseClient } from '@/lib/supabase-cadenza';

export type CompanyCounts = {
  totalJobs: number;
  totalRoutes: number;
  totalTeamMembers: number;
  totalProperties: number;
};

/**
 * Live, company-scoped dashboard counters.
 *
 * Previously the dashboard read `cadenza_company_stats`, a cache table that is only
 * filled by `refresh_company_stats()`; nothing calls that function, so companies
 * without a row (e.g. the demo company) always showed 0. Counting with
 * `head: true` returns no rows and mirrors refresh_company_stats() filters.
 */
export async function fetchCompanyCounts(
  client: CadenzaSupabaseClient,
  companyId: string,
): Promise<CompanyCounts> {
  const head = { count: 'exact' as const, head: true };
  const [jobs, routes, team, properties] = await Promise.all([
    client.from('cadenza_service_jobs').select('id', head).eq('company_id', companyId).eq('is_deleted', false),
    client.from('cadenza_routes').select('id', head).eq('company_id', companyId).eq('is_deleted', false),
    client.from('cadenza_profiles').select('id', head).eq('company_id', companyId),
    client.from('cadenza_properties').select('id', head).eq('company_id', companyId),
  ]);
  return {
    totalJobs: jobs.count ?? 0,
    totalRoutes: routes.count ?? 0,
    totalTeamMembers: team.count ?? 0,
    totalProperties: properties.count ?? 0,
  };
}
