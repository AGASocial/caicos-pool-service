import { fetchCompanyCounts } from '../company-counts';
import type { CadenzaSupabaseClient } from '../supabase-cadenza';

describe('fetchCompanyCounts', () => {
  it('counts live per table, scoped to the company with head queries', async () => {
    const counts: Record<string, number> = {
      cadenza_service_jobs: 3600,
      cadenza_routes: 150,
      cadenza_profiles: 31,
      cadenza_properties: 900,
    };
    const calls: { table: string; select: unknown[]; eq: [string, unknown][] }[] = [];
    const from = jest.fn((table: string) => {
      const rec = { table, select: [] as unknown[], eq: [] as [string, unknown][] };
      calls.push(rec);
      const q: Record<string, unknown> = {
        select: (...a: unknown[]) => { rec.select = a; return q; },
        eq: (k: string, v: unknown) => { rec.eq.push([k, v]); return q; },
        then: (res: (v: unknown) => unknown) => res({ count: counts[table], error: null }),
      };
      return q;
    });
    const result = await fetchCompanyCounts({ from } as unknown as CadenzaSupabaseClient, 'demo');
    expect(result).toEqual({ totalJobs: 3600, totalRoutes: 150, totalTeamMembers: 31, totalProperties: 900 });
    for (const c of calls) {
      expect(c.select[1]).toEqual({ count: 'exact', head: true });
      expect(c.eq).toContainEqual(['company_id', 'demo']);
    }
    expect(calls.find((c) => c.table === 'cadenza_service_jobs')!.eq).toContainEqual(['is_deleted', false]);
    expect(from).not.toHaveBeenCalledWith('cadenza_company_stats');
  });
});
