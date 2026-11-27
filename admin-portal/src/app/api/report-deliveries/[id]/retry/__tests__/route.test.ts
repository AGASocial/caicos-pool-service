/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server';
import { POST } from '../route';

jest.mock('@/lib/supabase-server', () => ({
  createAuthenticatedRouteClient: jest.fn(),
}));
jest.mock('@/lib/customer-reports/process', () => ({
  isCustomerAutoReportsEnabled: jest.fn(),
  processCustomerReportForJob: jest.fn(),
}));

import { createAuthenticatedRouteClient } from '@/lib/supabase-server';
import {
  isCustomerAutoReportsEnabled,
  processCustomerReportForJob,
} from '@/lib/customer-reports/process';

const mockCreateClient = createAuthenticatedRouteClient as jest.Mock;
const mockEnabled = isCustomerAutoReportsEnabled as jest.Mock;
const mockProcess = processCustomerReportForJob as jest.Mock;

const COMPANY = 'c0000000-0000-4000-8000-000000000001';
const DELIVERY = 'd0000000-0000-4000-8000-000000000009';
const JOB = 'b0000000-0000-4000-8000-000000000003';

function makeSupabase(opts: {
  role?: string;
  delivery?: Record<string, unknown> | null;
}) {
  const eqCalls: Array<[string, unknown]> = [];
  const deliveryQuery: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn((col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return deliveryQuery;
    }),
    maybeSingle: jest.fn().mockResolvedValue({ data: opts.delivery ?? null, error: null }),
  };
  const profileQuery = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({
      data: { company_id: COMPANY, role: opts.role ?? 'admin' },
      error: null,
    }),
  };
  return {
    supabase: {
      from: jest.fn((table: string) => (table === 'cadenza_profiles' ? profileQuery : deliveryQuery)),
    },
    eqCalls,
  };
}

const post = (id = DELIVERY, body: unknown = {}) =>
  POST(
    new NextRequest(`http://localhost/api/report-deliveries/${id}/retry`, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'Content-Type': 'application/json' },
    }),
    { params: Promise.resolve({ id }) },
  );

const failedRow = {
  id: DELIVERY,
  job_id: JOB,
  status: 'failed',
  updated_at: '2026-11-27T10:00:00.000Z',
  created_at: '2026-11-27T10:00:00.000Z',
};

describe('POST /api/report-deliveries/[id]/retry', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockEnabled.mockReturnValue(true);
    mockProcess.mockResolvedValue({ status: 'sent', deliveryId: DELIVERY });
  });

  it('AC-7: 401 when unauthenticated', async () => {
    mockCreateClient.mockResolvedValue({ supabase: {}, user: null });
    expect((await post()).status).toBe(401);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('AC-7: 403 for non-office roles', async () => {
    const { supabase } = makeSupabase({ role: 'technician', delivery: failedRow });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    expect((await post()).status).toBe(403);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('AC-6/AC-7: 404 when the delivery is not visible to the caller company', async () => {
    const { supabase, eqCalls } = makeSupabase({ delivery: null });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    expect((await post()).status).toBe(404);
    expect(eqCalls).toContainEqual(['company_id', COMPANY]);
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('AC-7: 400 for a malformed id', async () => {
    const { supabase } = makeSupabase({ delivery: failedRow });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    expect((await post('not-a-uuid')).status).toBe(400);
  });

  it.each(['sent', 'skipped'])('AC-7: 409 not_retryable for %s deliveries', async (status) => {
    const { supabase } = makeSupabase({ delivery: { ...failedRow, status } });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('not_retryable');
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('AC-7: 409 attempt_in_progress for a very recent pending delivery', async () => {
    const now = new Date().toISOString();
    const { supabase } = makeSupabase({
      delivery: { ...failedRow, status: 'queued', updated_at: now, created_at: now },
    });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('attempt_in_progress');
  });

  it('ADR-005: 409 auto_send_disabled when the kill switch is off (nothing processed)', async () => {
    mockEnabled.mockReturnValue(false);
    const { supabase } = makeSupabase({ delivery: failedRow });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const res = await post();
    expect(res.status).toBe(409);
    expect((await res.json()).code).toBe('auto_send_disabled');
    expect(mockProcess).not.toHaveBeenCalled();
  });

  it('AC-2/AC-7: retries a failed delivery as the calling user, scoped to their company', async () => {
    const { supabase } = makeSupabase({ delivery: failedRow });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'user-42' } });

    const res = await post(DELIVERY, { locale: 'es' });

    expect(res.status).toBe(200);
    expect(mockProcess).toHaveBeenCalledWith(JOB, {
      locale: 'es',
      companyId: COMPANY,
      actor: { source: 'retry', userId: 'user-42' },
    });
    expect(await res.json()).toMatchObject({ id: DELIVERY, status: 'sent' });
  });

  it('retries an old pending delivery', async () => {
    const { supabase } = makeSupabase({
      delivery: { ...failedRow, status: 'queued', updated_at: '2026-11-27T08:00:00.000Z' },
    });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    expect((await post()).status).toBe(200);
    expect(mockProcess).toHaveBeenCalledTimes(1);
  });

  it('reports a failed retry outcome', async () => {
    mockProcess.mockResolvedValue({ status: 'failed', reason: 'mailbox unavailable', deliveryId: DELIVERY });
    const { supabase } = makeSupabase({ delivery: failedRow });
    mockCreateClient.mockResolvedValue({ supabase, user: { id: 'u1' } });
    const body = await (await post()).json();
    expect(body).toMatchObject({ status: 'failed', reason: 'mailbox unavailable' });
  });
});
