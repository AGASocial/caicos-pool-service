/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { GET } from '../route';

jest.mock('@/lib/supabase-server', () => ({
  createAuthenticatedRouteClient: jest.fn(),
}));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';

const mockCreateClient = createAuthenticatedRouteClient as jest.Mock;

const COMPANY = 'c0000000-0000-4000-8000-000000000001';
const PROPERTY = 'a0000000-0000-4000-8000-000000000002';
const JOB = 'b0000000-0000-4000-8000-000000000003';

type Call = [string, ...unknown[]];

type Setup = {
  role?: string;
  companyId?: string | null;
  rows?: unknown[];
  count?: number;
  unsentCount?: number;
  matchedPropertyIds?: string[];
  deliveryError?: { code?: string; message: string } | null;
};

function makeSupabase(setup: Setup = {}) {
  const deliveryCalls: Call[] = [];
  const propertyCalls: Call[] = [];
  const countCalls: Call[] = [];

  const profileQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data:
        setup.companyId === null
          ? null
          : { company_id: setup.companyId ?? COMPANY, role: setup.role ?? 'admin' },
      error: null,
    }),
  };

  const chain = (calls: Call[], resolve: () => unknown) => {
    const q: Record<string, unknown> = {};
    for (const name of ['select', 'eq', 'in', 'gte', 'lt', 'or', 'order', 'range', 'limit']) {
      q[name] = (...args: unknown[]) => {
        calls.push([name, ...args]);
        return q;
      };
    }
    q.then = (res: (v: unknown) => unknown) => res(resolve());
    return q;
  };

  const supabase = {
    from: jest.fn((table: string) => {
      if (table === 'cadenza_profiles') return profileQuery;
      if (table === 'cadenza_properties') {
        return chain(propertyCalls, () => ({
          data: (setup.matchedPropertyIds ?? []).map((id) => ({ id })),
          error: null,
        }));
      }
      // customer_report_deliveries: head-count query vs data query
      let isHead = false;
      const q = chain(deliveryCalls, () =>
        isHead
          ? { count: setup.unsentCount ?? 0, error: null }
          : {
              data: setup.rows ?? [],
              count: setup.count ?? (setup.rows ?? []).length,
              error: setup.deliveryError ?? null,
            },
      );
      const originalSelect = q.select as (...a: unknown[]) => unknown;
      q.select = (cols: unknown, opts?: { head?: boolean }) => {
        if (opts?.head) {
          isHead = true;
          // route the head query to its own call log
          Object.assign(q, chain(countCalls, () => ({ count: setup.unsentCount ?? 0, error: null })));
          countCalls.push(['select', cols, opts]);
          return q;
        }
        return originalSelect(cols, opts);
      };
      return q;
    }),
  };

  return { supabase, deliveryCalls, propertyCalls, countCalls };
}

const get = (qs = '') => GET(new NextRequest(`http://localhost/api/report-deliveries${qs}`));

describe('GET /api/report-deliveries', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'info').mockImplementation(() => {});
  });

  it('AC-6: 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });
    const res = await get();
    expect(res.status).toBe(401);
  });

  it('AC-6: 403 when the profile has no company', async () => {
    const { supabase } = makeSupabase({ companyId: null });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    expect((await get()).status).toBe(403);
  });

  it('AC-6: 403 for roles without report.view (technician)', async () => {
    const { supabase, deliveryCalls } = makeSupabase({ role: 'technician' });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const res = await get();
    expect(res.status).toBe(403);
    expect(deliveryCalls).toHaveLength(0);
  });

  it('AC-5: 400 for malformed property_id / dates', async () => {
    const { supabase } = makeSupabase();
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    expect((await get('?property_id=nope')).status).toBe(400);
    expect((await get('?date_from=yesterday')).status).toBe(400);
  });

  it('AC-6: always filters by the caller company_id', async () => {
    const { supabase, deliveryCalls, countCalls } = makeSupabase();
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const res = await get();
    expect(res.status).toBe(200);
    expect(deliveryCalls).toContainEqual(['eq', 'company_id', COMPANY]);
    expect(countCalls).toContainEqual(['eq', 'company_id', COMPANY]);
  });

  it('AC-4: the unsent group filters pending + failed', async () => {
    const { supabase, deliveryCalls } = makeSupabase();
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    await get('?status=unsent');
    expect(deliveryCalls).toContainEqual(['in', 'status', ['queued', 'failed']]);
  });

  it('AC-5: filters by property_id, job_id and date range, and paginates', async () => {
    const { supabase, deliveryCalls } = makeSupabase({ rows: [], count: 60 });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const res = await get(
      `?property_id=${PROPERTY}&job_id=${JOB}&date_from=2026-11-01&date_to=2026-11-30&page=2&limit=10`,
    );
    const body = await res.json();
    expect(deliveryCalls).toContainEqual(['eq', 'property_id', PROPERTY]);
    expect(deliveryCalls).toContainEqual(['eq', 'job_id', JOB]);
    expect(deliveryCalls).toContainEqual(['gte', 'created_at', '2026-11-01T00:00:00.000Z']);
    expect(deliveryCalls).toContainEqual(['lt', 'created_at', '2026-12-01T00:00:00.000Z']);
    expect(deliveryCalls).toContainEqual(['range', 10, 19]);
    expect(body.pagination).toEqual({ page: 2, limit: 10, total: 60, hasMore: true });
  });

  it('AC-5: text search resolves company properties then matches recipient or those properties', async () => {
    const { supabase, deliveryCalls, propertyCalls } = makeSupabase({
      matchedPropertyIds: [PROPERTY],
    });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    await get('?q=Pool%20Lane');
    expect(propertyCalls).toContainEqual(['eq', 'company_id', COMPANY]);
    expect(deliveryCalls).toContainEqual([
      'or',
      `recipient.ilike.%Pool Lane%,property_id.in.(${PROPERTY})`,
    ]);
  });

  it('returns mapped rows with actor, status and the unsent count', async () => {
    const { supabase } = makeSupabase({
      unsentCount: 3,
      rows: [
        {
          id: 'd1',
          job_id: JOB,
          property_id: PROPERTY,
          recipient: 'customer@example.com',
          status: 'queued',
          reason: null,
          attempt_count: 1,
          trigger_source: 'auto',
          triggered_by: null,
          created_at: '2026-11-27T10:00:00.000Z',
          updated_at: '2026-11-27T10:00:00.000Z',
          job: { id: JOB, scheduled_date: '2026-11-27', status: 'completed' },
          property: { id: PROPERTY, customer_name: 'QA Pool Customer', address: '100 Test Pool Lane', city: 'Austin' },
          actor: null,
        },
      ],
    });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const body = await (await get()).json();
    expect(body.unsent_count).toBe(3);
    expect(body.data[0]).toMatchObject({
      id: 'd1',
      status: 'pending',
      actor: { type: 'system' },
      property: { customer_name: 'QA Pool Customer' },
    });
  });

  it('ADR-004: 503 SCHEMA_PENDING when the migration is not applied', async () => {
    const { supabase } = makeSupabase({
      deliveryError: { code: '42703', message: 'column property_id does not exist' },
    });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const res = await get();
    expect(res.status).toBe(503);
    expect((await res.json()).code).toBe('SCHEMA_PENDING');
  });
});
