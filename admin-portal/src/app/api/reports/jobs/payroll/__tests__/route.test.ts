/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';

jest.mock('@/lib/supabase-server', () => ({ createAuthenticatedRouteClient: jest.fn() }));
import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
const mockCreate = createAuthenticatedRouteClient as jest.Mock;

function chain(result: unknown) {
  const c: Record<string, jest.Mock> = {};
  for (const m of ['select', 'eq', 'gte', 'lte', 'not', 'order', 'in']) c[m] = jest.fn(() => c);
  c.single = jest.fn().mockResolvedValue(result);
  c.range = jest.fn().mockResolvedValue(result);
  return c;
}

describe('GET /api/reports/jobs/payroll', () => {
  beforeEach(() => jest.clearAllMocks());

  it('401 when unauthenticated', async () => {
    mockCreate.mockResolvedValue({ supabase: {}, user: null });
    const res = await GET(new NextRequest('http://x/api/reports/jobs/payroll'));
    expect(res.status).toBe(401);
  });

  it('400 on bad range', async () => {
    const profile = chain({ data: { company_id: 'c1', role: 'admin' }, error: null });
    mockCreate.mockResolvedValue({ supabase: { from: jest.fn(() => profile), rpc: jest.fn() }, user: { id: 'u' } });
    const res = await GET(new NextRequest('http://x/api/reports/jobs/payroll?date_from=2026-10-10&date_to=2026-10-01'));
    expect(res.status).toBe(400);
  });

  it('returns BOM CSV scoped to company', async () => {
    const profile = chain({ data: { company_id: 'c1', role: 'admin' }, error: null });
    const jobs = chain({
      data: [{ id: 'j', scheduled_date: '2026-10-01', technician_id: 't', technician: { full_name: 'Tech' },
        property: { customer_name: 'Cust', address: '1 A St' }, reports: [{ departure_time: '2026-10-01T15:00:00Z' }] }],
      error: null,
    });
    const from = jest.fn((t: string) => (t === 'cadenza_profiles' ? profile : jobs));
    const rpc = jest.fn().mockResolvedValue({ data: { byTechnician: [{ technicianId: 't', fullName: 'Tech', total: 1, completed: 1 }] }, error: null });
    mockCreate.mockResolvedValue({ supabase: { from, rpc }, user: { id: 'u' } });
    const res = await GET(new NextRequest('http://x/api/reports/jobs/payroll?date_from=2026-10-01&date_to=2026-10-07'));
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/csv');
    const buf = new Uint8Array(await res.arrayBuffer());
    expect([buf[0], buf[1], buf[2]]).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder().decode(buf);
    expect(text).toContain('Tech,2026-10-01,Cust,1 A St,2026-10-01 10:00');
    expect(jobs.eq).toHaveBeenCalledWith('company_id', 'c1');
    expect(rpc).toHaveBeenCalledWith('get_job_report_stats', { p_company_id: 'c1', p_date_from: '2026-10-01', p_date_to: '2026-10-07' });
  });
});
