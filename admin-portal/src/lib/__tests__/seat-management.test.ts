/**
 * Seat management: Free cap, per-seat auto-bump, deferred deactivation.
 */

import {
  canAddTechnician,
  validateTechnicianInvite,
  ensureSeatForNewTechnician,
  scheduleTechnicianDeactivation,
  activateTechnician,
  processDueTechnicianDeactivations,
  getSeatInfo,
  SEAT_ADDED_PRORATION_NOTICE,
  DEFAULT_FREE_MAX_TECHNICIANS,
} from '../seat-management';
import type { BillingService } from '../billing/billing.service';

function chainable(terminal: Record<string, unknown>) {
  const api: Record<string, unknown> = {};
  const self = () => api;
  for (const method of [
    'select',
    'eq',
    'in',
    'is',
    'not',
    'lte',
    'order',
    'limit',
    'update',
    'insert',
  ]) {
    api[method] = jest.fn(() => self());
  }
  api.maybeSingle = jest.fn(() => Promise.resolve(terminal.maybeSingle ?? { data: null, error: null }));
  api.single = jest.fn(() => Promise.resolve(terminal.single ?? { data: null, error: null }));
  // head count queries resolve on the final eq()
  Object.assign(api, terminal.extras ?? {});
  return api;
}

describe('seat-management', () => {
  const updateSubscription = jest.fn();
  const getUserSubscription = jest.fn();
  const getPlan = jest.fn();

  const deps = {
    getBillingService: jest.fn(async () =>
      ({
        getUserSubscription,
        getPlan,
        updateSubscription,
      }) as unknown as BillingService
    ),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  function mockSupabase(opts: {
    companyId?: string;
    ownerId?: string;
    activeCount?: number;
    pending?: Array<{ id: string; full_name: string; scheduled_deactivation_at: string }>;
    tech?: Record<string, unknown> | null;
    updateError?: { message: string } | null;
  }) {
    const companyId = opts.companyId ?? 'co-1';
    const ownerId = opts.ownerId ?? 'owner-1';
    const activeCount = opts.activeCount ?? 0;

    return {
      from: jest.fn((table: string) => {
        if (table !== 'cadenza_profiles') return chainable({});

        return {
          select: jest.fn((cols: string, options?: { count?: string; head?: boolean }) => {
            if (options?.head && options?.count === 'exact') {
              const q: Record<string, unknown> = {};
              const self = () => q;
              q.eq = jest.fn(() => self());
              // Final thenable
              Object.assign(q, {
                then: undefined,
              });
              // Make the chain thenable by returning a promise from the last eq
              let eqCount = 0;
              q.eq = jest.fn(() => {
                eqCount += 1;
                if (eqCount >= 3) {
                  return Promise.resolve({ count: activeCount, error: null });
                }
                return q;
              });
              return q;
            }

            if (cols === 'company_id') {
              return chainable({
                maybeSingle: { data: { company_id: companyId }, error: null },
              });
            }

            if (cols.includes('full_name') && cols.includes('scheduled_deactivation_at')) {
              const pendingApi = chainable({});
              pendingApi.eq = jest.fn(() => pendingApi);
              pendingApi.not = jest.fn(() => pendingApi);
              pendingApi.order = jest.fn(() =>
                Promise.resolve({ data: opts.pending ?? [], error: null })
              );
              return pendingApi;
            }

            if (cols.includes('role') && cols.includes('is_active')) {
              return chainable({
                maybeSingle: { data: opts.tech ?? null, error: null },
                single: { data: opts.tech ?? null, error: null },
              });
            }

            if (cols === 'id') {
              const api = chainable({});
              api.eq = jest.fn((key: string, val: unknown) => {
                if (key === 'role' && val === 'owner') {
                  return chainable({
                    maybeSingle: { data: { id: ownerId }, error: null },
                  });
                }
                if (key === 'id') {
                  return chainable({
                    maybeSingle: { data: opts.tech ?? null, error: null },
                    single: { data: opts.tech ?? null, error: null },
                  });
                }
                return api;
              });
              return api;
            }

            return chainable({
              maybeSingle: { data: { company_id: companyId }, error: null },
            });
          }),
          update: jest.fn(() => ({
            eq: jest.fn(() => Promise.resolve({ error: opts.updateError ?? null })),
            in: jest.fn(() => Promise.resolve({ error: opts.updateError ?? null })),
          })),
        };
      }),
    };
  }

  describe('canAddTechnician / validateTechnicianInvite (Free cap)', () => {
    it('blocks Free plan at max 3 technicians', async () => {
      getUserSubscription.mockResolvedValue(null);
      getPlan.mockResolvedValue({
        id: 'plan_free',
        pricingModel: 'flat',
        features: { max_technicians: 3 },
      });

      const supabase = mockSupabase({ activeCount: 3 });
      const result = await canAddTechnician(supabase as never, 'owner-1', deps);

      expect(result.canAdd).toBe(false);
      expect(result.code).toBe('TECHNICIAN_LIMIT_REACHED');
      expect(result.max).toBe(DEFAULT_FREE_MAX_TECHNICIANS);
    });

    it('allows Free plan under the cap', async () => {
      getUserSubscription.mockResolvedValue({
        id: 'sub-free',
        planId: 'plan_free',
        status: 'active',
        quantity: 1,
      });
      getPlan.mockResolvedValue({
        id: 'plan_free',
        pricingModel: 'flat',
        features: { max_technicians: 3 },
      });

      const supabase = mockSupabase({ activeCount: 2 });
      const result = await canAddTechnician(supabase as never, 'owner-1', deps);
      expect(result.canAdd).toBe(true);
    });

    it('validateTechnicianInvite shares Free cap with canAddTechnician', async () => {
      getUserSubscription.mockResolvedValue(null);
      getPlan.mockResolvedValue({
        id: 'plan_free',
        features: { max_technicians: 3 },
      });
      const supabase = mockSupabase({ activeCount: 3 });
      const gate = await validateTechnicianInvite(supabase as never, 'owner-1', 'technician', deps);
      expect(gate.valid).toBe(false);
      expect(gate.code).toBe('TECHNICIAN_LIMIT_REACHED');
    });

    it('skips seat check for non-technician roles', async () => {
      const supabase = mockSupabase({ activeCount: 99 });
      const gate = await validateTechnicianInvite(supabase as never, 'owner-1', 'admin', deps);
      expect(gate.valid).toBe(true);
      expect(deps.getBillingService).not.toHaveBeenCalled();
    });
  });

  describe('paid per-seat auto-increase', () => {
    const periodEnd = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    beforeEach(() => {
      getUserSubscription.mockResolvedValue({
        id: 'sub-1',
        planId: 'plan_standard_month',
        status: 'active',
        quantity: 3,
        providerSubscriptionId: 'sub_stripe_1',
        currentPeriodEnd: periodEnd,
      });
      getPlan.mockResolvedValue({
        id: 'plan_standard_month',
        pricingModel: 'per_technician',
        features: { max_technicians: -1 },
      });
    });

    it('allows invite beyond seats and marks willIncreaseSeat', async () => {
      const supabase = mockSupabase({ activeCount: 3 });
      const result = await canAddTechnician(supabase as never, 'owner-1', deps);
      expect(result.canAdd).toBe(true);
      expect(result.willIncreaseSeat).toBe(true);
      expect(result.isPerSeat).toBe(true);
    });

    it('bumps Stripe quantity with create_prorations and returns notice', async () => {
      updateSubscription.mockResolvedValue(undefined);
      const supabase = mockSupabase({ activeCount: 4 });
      const result = await ensureSeatForNewTechnician(supabase as never, 'owner-1', deps);

      expect(result.ok).toBe(true);
      expect(result.seatAdded).toBe(true);
      expect(result.notice).toBe(SEAT_ADDED_PRORATION_NOTICE);
      expect(updateSubscription).toHaveBeenCalledWith({
        subscriptionId: 'sub-1',
        quantity: 4,
        prorationBehavior: 'create_prorations',
      });
    });

    it('does not bump when within paid seats', async () => {
      const supabase = mockSupabase({ activeCount: 2 });
      const result = await ensureSeatForNewTechnician(supabase as never, 'owner-1', deps);
      expect(result.ok).toBe(true);
      expect(result.seatAdded).toBeFalsy();
      expect(updateSubscription).not.toHaveBeenCalled();
    });
  });

  describe('deferred deactivation', () => {
    const periodEnd = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);

    beforeEach(() => {
      getUserSubscription.mockResolvedValue({
        id: 'sub-1',
        planId: 'plan_standard_month',
        status: 'active',
        quantity: 5,
        providerSubscriptionId: 'sub_stripe_1',
        currentPeriodEnd: periodEnd,
      });
      getPlan.mockResolvedValue({
        id: 'plan_standard_month',
        pricingModel: 'per_technician',
        features: {},
      });
    });

    it('schedules deactivation, keeps access, lowers quantity with proration none', async () => {
      updateSubscription.mockResolvedValue(undefined);
      const supabase = mockSupabase({
        activeCount: 5,
        tech: {
          id: 'tech-1',
          company_id: 'co-1',
          role: 'technician',
          is_active: true,
          scheduled_deactivation_at: null,
        },
      });

      const result = await scheduleTechnicianDeactivation(
        supabase as never,
        'owner-1',
        'tech-1',
        deps
      );

      expect(result.ok).toBe(true);
      expect(result.is_active).toBe(true);
      expect(result.pending).toBe(true);
      expect(result.scheduled_deactivation_at).toBe(periodEnd.toISOString());
      expect(updateSubscription).toHaveBeenCalledWith({
        subscriptionId: 'sub-1',
        quantity: 4,
        prorationBehavior: 'none',
      });
    });

    it('cancels pending deactivation and may re-add seat', async () => {
      updateSubscription.mockResolvedValue(undefined);
      getUserSubscription.mockResolvedValue({
        id: 'sub-1',
        planId: 'plan_standard_month',
        status: 'active',
        quantity: 4,
        providerSubscriptionId: 'sub_stripe_1',
        currentPeriodEnd: periodEnd,
      });

      const supabase = mockSupabase({
        activeCount: 5,
        tech: {
          id: 'tech-1',
          company_id: 'co-1',
          role: 'technician',
          is_active: true,
          scheduled_deactivation_at: periodEnd.toISOString(),
        },
      });

      const result = await activateTechnician(supabase as never, 'owner-1', 'tech-1', deps);
      expect(result.ok).toBe(true);
      expect(result.scheduled_deactivation_at).toBeNull();
      expect(updateSubscription).toHaveBeenCalledWith({
        subscriptionId: 'sub-1',
        quantity: 5,
        prorationBehavior: 'create_prorations',
      });
      expect(result.notice).toBe(SEAT_ADDED_PRORATION_NOTICE);
    });

    it('processDueTechnicianDeactivations deactivates due rows', async () => {
      const dueIds = [{ id: 't1' }, { id: 't2' }];
      const updateIn = jest.fn(() => Promise.resolve({ error: null }));
      const supabase = {
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              eq: jest.fn(() => ({
                not: jest.fn(() => ({
                  lte: jest.fn(() => Promise.resolve({ data: dueIds, error: null })),
                })),
              })),
            })),
          })),
          update: jest.fn(() => ({
            in: updateIn,
          })),
        })),
      };

      const result = await processDueTechnicianDeactivations(supabase as never, new Date());
      expect(result.processed).toBe(2);
      expect(updateIn).toHaveBeenCalledWith('id', ['t1', 't2']);
    });
  });

  describe('getSeatInfo', () => {
    it('includes pending deactivations and over-limit flag', async () => {
      getUserSubscription.mockResolvedValue({
        id: 'sub-1',
        planId: 'plan_standard_month',
        status: 'active',
        quantity: 2,
        providerSubscriptionId: 'sub_stripe_1',
        currentPeriodEnd: new Date('2026-12-01T00:00:00.000Z'),
      });
      getPlan.mockResolvedValue({
        id: 'plan_standard_month',
        pricingModel: 'per_technician',
        features: {},
      });

      const pending = [
        {
          id: 'tech-1',
          full_name: 'Ana',
          scheduled_deactivation_at: '2026-12-01T00:00:00.000Z',
        },
      ];
      const supabase = mockSupabase({ activeCount: 3, pending });
      const info = await getSeatInfo(supabase as never, 'owner-1', deps);

      expect(info.isOverLimit).toBe(true);
      expect(info.active).toBe(3);
      expect(info.subscribed).toBe(2);
      expect(info.pendingDeactivations).toEqual(pending);
      expect(info.isPerSeat).toBe(true);
    });
  });
});
