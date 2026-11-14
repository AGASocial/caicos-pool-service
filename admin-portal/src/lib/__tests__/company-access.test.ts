/**
 * @jest-environment node
 */
/**
 * Company access mode + API write guard allowlist / 402 behavior
 */

import { NextRequest } from 'next/server';
import {
  evaluateFreePlanExpiry,
  isApiWriteAllowlisted,
  isMutatingMethod,
  FREE_PLAN_EXPIRED,
  freePlanExpiredResponse,
  enforceApiWriteAccess,
  getCompanyAccessModeEdge,
} from '../company-access';

describe('evaluateFreePlanExpiry', () => {
  const now = new Date('2026-11-13T12:00:00.000Z');

  it('returns not expired for non-free plans', () => {
    expect(
      evaluateFreePlanExpiry({
        planId: 'plan_pro_month',
        currentPeriodEnd: '2020-01-01T00:00:00.000Z',
        now,
      }),
    ).toEqual({ expired: false });
  });

  it('uses currentPeriodEnd when set', () => {
    const past = evaluateFreePlanExpiry({
      planId: 'plan_free',
      currentPeriodEnd: '2026-10-01T00:00:00.000Z',
      now,
    });
    expect(past.expired).toBe(true);
    expect(past.daysRemaining).toBe(0);

    const future = evaluateFreePlanExpiry({
      planId: 'plan_free',
      currentPeriodEnd: '2026-12-13T00:00:00.000Z',
      now,
    });
    expect(future.expired).toBe(false);
    expect(future.daysRemaining).toBeGreaterThan(0);
  });

  it('falls back to createdAt + planDurationDays', () => {
    const result = evaluateFreePlanExpiry({
      planId: 'plan_free',
      createdAt: '2026-10-01T00:00:00.000Z',
      planDurationDays: 30,
      now,
    });
    expect(result.expired).toBe(true);
  });
});

describe('API write allowlist / methods', () => {
  it('allowlists billing, auth, webhooks, cron, subscription', () => {
    expect(isApiWriteAllowlisted('/api/billing/checkout')).toBe(true);
    expect(isApiWriteAllowlisted('/api/billing/portal')).toBe(true);
    expect(isApiWriteAllowlisted('/api/billing/subscriptions/free')).toBe(true);
    expect(isApiWriteAllowlisted('/api/webhooks/stripe')).toBe(true);
    expect(isApiWriteAllowlisted('/api/auth/login')).toBe(true);
    expect(isApiWriteAllowlisted('/api/cron/generate-route-jobs')).toBe(true);
    expect(isApiWriteAllowlisted('/api/subscription/status')).toBe(true);
  });

  it('does not allowlist domain mutating routes', () => {
    expect(isApiWriteAllowlisted('/api/properties')).toBe(false);
    expect(isApiWriteAllowlisted('/api/invite-codes')).toBe(false);
    expect(isApiWriteAllowlisted('/api/jobs')).toBe(false);
    expect(isApiWriteAllowlisted('/api/routes')).toBe(false);
    expect(isApiWriteAllowlisted('/api/team')).toBe(false);
  });

  it('detects mutating methods', () => {
    expect(isMutatingMethod('POST')).toBe(true);
    expect(isMutatingMethod('get')).toBe(false);
  });

  it('freePlanExpiredResponse is 402 with FREE_PLAN_EXPIRED', async () => {
    const res = freePlanExpiredResponse();
    expect(res.status).toBe(402);
    const body = await res.json();
    expect(body.code).toBe(FREE_PLAN_EXPIRED);
  });
});

describe('enforceApiWriteAccess', () => {
  const prevUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const prevKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = prevUrl;
    process.env.SUPABASE_SERVICE_ROLE_KEY = prevKey;
    jest.restoreAllMocks();
  });

  it('allows allowlisted POST without checking subscription', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role';
    const req = new NextRequest('http://localhost/api/billing/checkout', { method: 'POST' });
    const result = await enforceApiWriteAccess(req, 'user-1');
    expect(result).toBeNull();
  });

  it('allows GET on blocked paths', async () => {
    const req = new NextRequest('http://localhost/api/properties', { method: 'GET' });
    const result = await enforceApiWriteAccess(req, 'user-1');
    expect(result).toBeNull();
  });

  it('getCompanyAccessModeEdge returns read_only when free period ended', async () => {
    let profileCalls = 0;
    const mockFrom = jest.fn((table: string) => {
      if (table === 'cadenza_profiles') {
        profileCalls += 1;
        if (profileCalls === 1) {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: { company_id: 'co-1' }, error: null }),
              }),
            }),
          };
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () => ({
                  limit: () => ({
                    maybeSingle: async () => ({ data: { id: 'owner-1' }, error: null }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      if (table === 'cadenza_billing_subscriptions') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  order: () => ({
                    limit: () => ({
                      maybeSingle: async () => ({
                        data: {
                          id: 'sub-1',
                          plan_id: 'plan_free',
                          status: 'active',
                          current_period_end: '2020-01-01T00:00:00.000Z',
                          created_at: '2019-12-01T00:00:00.000Z',
                        },
                        error: null,
                      }),
                    }),
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) };
    });

    const access = await getCompanyAccessModeEdge({ from: mockFrom } as never, 'user-1');
    expect(access.mode).toBe('read_only');
    expect(access.code).toBe(FREE_PLAN_EXPIRED);
    expect(access.billingUserId).toBe('owner-1');
  });
});
