/**
 * @jest-environment node
 *
 * KAN-148 dunning: grace start (no extend), invoice.paid clear+renew,
 * trial_will_end / deleted emails, grace cron cancel + idempotency.
 */

import { BillingService, BILLING_GRACE_PERIOD_DAYS } from '../billing.service';
import { StripeWebhookNormalizer } from '../adapters/stripe-webhook.normalizer';
import type { PaymentGateway } from '../gateway.interface';
import type { InvoiceEventData, SubscriptionEventData } from '../types';

const sendPaymentFailedEmail = jest.fn(async (..._args: unknown[]) => true);
const sendTrialEndingEmail = jest.fn(async (..._args: unknown[]) => true);
const sendSubscriptionCanceledEmail = jest.fn(async (..._args: unknown[]) => true);

jest.mock('@/lib/email/billing-mailer', () => ({
  sendPaymentFailedEmail: (...args: unknown[]) =>
    (sendPaymentFailedEmail as (...a: unknown[]) => Promise<boolean>)(...args),
  sendTrialEndingEmail: (...args: unknown[]) =>
    (sendTrialEndingEmail as (...a: unknown[]) => Promise<boolean>)(...args),
  sendSubscriptionCanceledEmail: (...args: unknown[]) =>
    (sendSubscriptionCanceledEmail as (...a: unknown[]) => Promise<boolean>)(
      ...args,
    ),
}));

jest.mock('@/lib/seat-management', () => ({
  processDueTechnicianDeactivations: jest.fn(async () => ({ processed: 0 })),
}));

function mockGateway(overrides: Partial<PaymentGateway> = {}): PaymentGateway {
  return {
    getName: () => 'stripe',
    createCustomer: jest.fn(),
    attachPaymentMethod: jest.fn(),
    setDefaultPaymentMethod: jest.fn(),
    detachPaymentMethod: jest.fn(),
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(async () => undefined),
    reactivateSubscription: jest.fn(),
    createCheckoutSession: jest.fn(),
    createPortalSession: jest.fn(),
    getInvoices: jest.fn(),
    getInvoice: jest.fn(),
    constructWebhookEvent: jest.fn(),
    ...overrides,
  } as unknown as PaymentGateway;
}

type Row = Record<string, unknown>;

/**
 * Minimal thenable query builder for BillingService dunning paths.
 */
function createDunningSupabase(state: {
  subByProviderId: Map<string, Row>;
  expiredQuery: Row[];
}) {
  const companyUpdates: Row[] = [];

  const auth = {
    admin: {
      getUserById: async () => ({
        data: {
          user: {
            email: 'owner@example.com',
            user_metadata: { locale: 'es' },
          },
        },
        error: null,
      }),
    },
  };

  function profilesBuilder() {
    return {
      select: () => ({
        eq: (_c: string, _v: unknown) => ({
          maybeSingle: async () => ({
            data: { id: 'user-1', company_id: 'co-1', email: 'owner@example.com' },
            error: null,
          }),
          eq: () => ({
            order: () => ({
              limit: () => ({
                maybeSingle: async () => ({
                  data: { id: 'user-1', email: 'owner@example.com' },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      }),
    };
  }

  function plansBuilder() {
    const plan = {
      id: 'plan_free',
      name: 'Free',
      currency: 'USD',
      amount_cents: 0,
      interval: 'month',
      features: { plan_duration_days: 30 },
    };
    const list = {
      data: [plan],
      error: null as null,
    };
    const chain: Record<string, unknown> = {
      eq: () => ({
        single: async () => ({ data: plan, error: null }),
        maybeSingle: async () => ({ data: plan, error: null }),
      }),
      order: () => chain,
      then: (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        Promise.resolve(list).then(resolve, reject),
    };
    return {
      select: () => chain,
    };
  }

  function subscriptionsBuilder() {
    let pendingUpdate: Row | null = null;
    let filterProviderId: string | null = null;
    let filterId: string | null = null;
    let filterStatus: string | null = null;
    let filterUserId: string | null = null;
    let filterPlanId: string | null = null;
    let isExpiredGraceQuery = false;

    const api: Record<string, unknown> = {
      select: () => api,
      eq: (col: string, val: unknown) => {
        if (col === 'provider_subscription_id') filterProviderId = String(val);
        if (col === 'id') filterId = String(val);
        if (col === 'status') filterStatus = String(val);
        if (col === 'user_id') filterUserId = String(val);
        if (col === 'plan_id') filterPlanId = String(val);
        return api;
      },
      in: () => api,
      not: () => {
        isExpiredGraceQuery = true;
        return api;
      },
      lt: async () => {
        if (isExpiredGraceQuery) {
          return { data: state.expiredQuery.filter((r) => r.status === 'past_due'), error: null };
        }
        return { data: [], error: null };
      },
      order: () => api,
      limit: () => api,
      maybeSingle: async () => {
        if (filterProviderId) {
          return {
            data: state.subByProviderId.get(filterProviderId) ?? null,
            error: null,
          };
        }
        if (filterUserId && filterPlanId === 'plan_free') {
          for (const row of state.subByProviderId.values()) {
            if (row.user_id === filterUserId && row.plan_id === 'plan_free') {
              return { data: row, error: null };
            }
          }
          return { data: null, error: null };
        }
        return { data: null, error: null };
      },
      single: async () => {
        const r = await (api.maybeSingle as () => Promise<{ data: Row | null; error: null }>)();
        return r;
      },
      update: (payload: Row) => {
        pendingUpdate = payload;
        return api;
      },
      insert: (row: Row) => ({
        select: () => ({
          single: async () => {
            const inserted = {
              id: 'free_new',
              provider_subscription_id: row.provider_subscription_id,
              ...row,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            };
            state.subByProviderId.set(String(row.provider_subscription_id), inserted);
            return { data: inserted, error: null };
          },
        }),
      }),
      upsert: async () => ({ error: null }),
    };

    // Make update().eq()... awaitable and apply filters
    const origEq = api.eq as (col: string, val: unknown) => typeof api;
    api.eq = (col: string, val: unknown) => {
      origEq(col, val);
      return api;
    };

    api.select = (_cols?: string) => {
      // Starting a fresh read query — reset filters.
      // If we're mid-update (pendingUpdate set), keep filters for .eq().select().maybeSingle().
      if (!pendingUpdate) {
        filterProviderId = null;
        filterId = null;
        filterStatus = null;
        filterUserId = null;
        filterPlanId = null;
        isExpiredGraceQuery = false;
      }
      return api;
    };

    // Apply pending update when chain ends (await or maybeSingle after update)
    const applyUpdate = () => {
      if (!pendingUpdate) return { data: null, error: null };
      const payload = pendingUpdate;
      pendingUpdate = null;

      let target: Row | undefined;
      if (filterProviderId) target = state.subByProviderId.get(filterProviderId);
      if (filterId) {
        for (const row of state.subByProviderId.values()) {
          if (row.id === filterId) target = row;
        }
      }
      if (!target) return { data: null, error: null };
      if (filterStatus && target.status !== filterStatus) {
        return { data: null, error: null };
      }
      Object.assign(target, payload);
      // keep expiredQuery in sync
      state.expiredQuery = state.expiredQuery.map((r) =>
        r.id === target!.id ? { ...target! } : r,
      );
      return { data: { id: target.id }, error: null };
    };

    api.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) => {
      try {
        return Promise.resolve(applyUpdate()).then(resolve, reject);
      } catch (e) {
        return Promise.reject(e).then(resolve, reject);
      }
    };

    const origMaybe = api.maybeSingle as () => Promise<{ data: Row | null; error: null }>;
    api.maybeSingle = async () => {
      if (pendingUpdate) return applyUpdate();
      return origMaybe();
    };

    return api;
  }

  return {
    auth,
    companyUpdates,
    from: (table: string) => {
      if (table === 'cadenza_billing_webhook_events') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
          insert: async () => ({ error: null }),
        };
      }
      if (table === 'cadenza_billing_subscriptions') return subscriptionsBuilder();
      if (table === 'cadenza_billing_invoices') {
        return { upsert: async () => ({ error: null }) };
      }
      if (table === 'cadenza_profiles') return profilesBuilder();
      if (table === 'cadenza_billing_plans') return plansBuilder();
      if (table === 'cadenza_companies') {
        return {
          update: (payload: Row) => {
            companyUpdates.push(payload);
            return { eq: async () => ({ error: null }) };
          },
        };
      }
      if (table === 'cadenza_billing_payment_methods') {
        return {
          select: () => ({
            eq: () => ({
              limit: () => ({
                maybeSingle: async () => ({ data: null, error: null }),
              }),
            }),
          }),
        };
      }
      return {
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
        }),
      };
    },
  };
}

describe('dunning webhooks', () => {
  beforeEach(() => {
    sendPaymentFailedEmail.mockClear();
    sendTrialEndingEmail.mockClear();
    sendSubscriptionCanceledEmail.mockClear();
  });

  it('payment_failed starts 14-day grace and does not extend on second failure', async () => {
    const fixedNow = new Date('2026-11-13T12:00:00.000Z');
    jest.useFakeTimers().setSystemTime(fixedNow);

    const sub: Row = {
      id: 'sub_db',
      user_id: 'user-1',
      plan_id: 'plan_necessary_month',
      status: 'active',
      provider: 'stripe',
      provider_subscription_id: 'sub_stripe_1',
      payment_failed_at: null,
      grace_period_ends_at: null,
    };
    const state = {
      subByProviderId: new Map([['sub_stripe_1', sub]]),
      expiredQuery: [] as Row[],
    };
    const supabase = createDunningSupabase(state);
    const service = new BillingService(supabase as never, mockGateway());

    const baseData: InvoiceEventData = {
      invoiceId: 'in_1',
      customerId: 'cus_1',
      subscriptionId: 'sub_stripe_1',
      amountCents: 1499,
      currency: 'USD',
      status: 'open',
      issuedAt: fixedNow.toISOString(),
    };

    await service.handleWebhookEvent({
      id: 'evt_fail_1',
      type: 'invoice.payment_failed',
      occurredAt: fixedNow.toISOString(),
      provider: 'stripe',
      raw: {},
      data: baseData,
    });

    const expectedGrace = new Date(
      fixedNow.getTime() + BILLING_GRACE_PERIOD_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();

    expect(sub.status).toBe('past_due');
    expect(sub.payment_failed_at).toBe(fixedNow.toISOString());
    expect(sub.grace_period_ends_at).toBe(expectedGrace);
    expect(sendPaymentFailedEmail).toHaveBeenCalledTimes(1);

    jest.setSystemTime(new Date('2026-11-16T12:00:00.000Z'));
    const graceBefore = sub.grace_period_ends_at;
    const failedAtBefore = sub.payment_failed_at;

    await service.handleWebhookEvent({
      id: 'evt_fail_2',
      type: 'invoice.payment_failed',
      occurredAt: new Date().toISOString(),
      provider: 'stripe',
      raw: {},
      data: { ...baseData, invoiceId: 'in_2' },
    });

    expect(sub.grace_period_ends_at).toBe(graceBefore);
    expect(sub.payment_failed_at).toBe(failedAtBefore);
    expect(sendPaymentFailedEmail).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });

  it('invoice.paid clears grace fields and renews period from invoice lines', async () => {
    const sub: Row = {
      id: 'sub_db',
      user_id: 'user-1',
      plan_id: 'plan_necessary_month',
      status: 'past_due',
      provider: 'stripe',
      provider_subscription_id: 'sub_stripe_1',
      payment_failed_at: '2026-11-01T00:00:00.000Z',
      grace_period_ends_at: '2026-11-15T00:00:00.000Z',
    };
    const state = {
      subByProviderId: new Map([['sub_stripe_1', sub]]),
      expiredQuery: [] as Row[],
    };
    const service = new BillingService(
      createDunningSupabase(state) as never,
      mockGateway(),
    );

    await service.handleWebhookEvent({
      id: 'evt_paid_1',
      type: 'invoice.paid',
      occurredAt: '2026-11-13T00:00:00.000Z',
      provider: 'stripe',
      raw: {},
      data: {
        invoiceId: 'in_paid',
        customerId: 'cus_1',
        subscriptionId: 'sub_stripe_1',
        amountCents: 1499,
        currency: 'USD',
        status: 'paid',
        issuedAt: '2026-11-13T00:00:00.000Z',
        paidAt: '2026-11-13T00:00:00.000Z',
        periodStart: '2026-11-13T00:00:00.000Z',
        periodEnd: '2026-12-13T00:00:00.000Z',
      } satisfies InvoiceEventData,
    });

    expect(sub.status).toBe('active');
    expect(sub.payment_failed_at).toBeNull();
    expect(sub.grace_period_ends_at).toBeNull();
    expect(sub.current_period_start).toBe('2026-11-13T00:00:00.000Z');
    expect(sub.current_period_end).toBe('2026-12-13T00:00:00.000Z');
  });

  it('trial_will_end and subscription.canceled send emails (mocked mailer)', async () => {
    const sub: Row = {
      id: 'sub_db',
      user_id: 'user-1',
      plan_id: 'plan_necessary_month',
      status: 'trialing',
      provider: 'stripe',
      provider_subscription_id: 'sub_stripe_1',
    };
    const state = {
      subByProviderId: new Map([['sub_stripe_1', sub]]),
      expiredQuery: [] as Row[],
    };
    const service = new BillingService(
      createDunningSupabase(state) as never,
      mockGateway(),
    );

    await service.handleWebhookEvent({
      id: 'evt_trial',
      type: 'subscription.trial_will_end',
      occurredAt: '2026-11-13T00:00:00.000Z',
      provider: 'stripe',
      raw: {},
      data: {
        subscriptionId: 'sub_stripe_1',
        customerId: 'cus_1',
        userId: 'user-1',
        status: 'trialing',
        currentPeriodEnd: '2026-11-20T00:00:00.000Z',
      } satisfies SubscriptionEventData,
    });
    expect(sendTrialEndingEmail).toHaveBeenCalledTimes(1);

    await service.handleWebhookEvent({
      id: 'evt_del',
      type: 'subscription.canceled',
      occurredAt: '2026-11-13T00:00:00.000Z',
      provider: 'stripe',
      raw: {},
      data: {
        subscriptionId: 'sub_stripe_1',
        customerId: 'cus_1',
        userId: 'user-1',
        status: 'canceled',
      } satisfies SubscriptionEventData,
    });
    expect(sendSubscriptionCanceledEmail).toHaveBeenCalledTimes(1);
    expect(sendSubscriptionCanceledEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        idempotencyKey: 'billing/subscription-canceled/sub_stripe_1',
      }),
    );
  });

  it('cron cancels expired grace and is idempotent on re-run', async () => {
    const cancelSubscription = jest.fn(async () => undefined);
    const expired: Row = {
      id: 'sub_db',
      user_id: 'user-1',
      plan_id: 'plan_necessary_month',
      provider: 'stripe',
      provider_subscription_id: 'sub_stripe_1',
      status: 'past_due',
      grace_period_ends_at: '2026-11-01T00:00:00.000Z',
    };
    const state = {
      subByProviderId: new Map([['sub_stripe_1', expired]]),
      expiredQuery: [expired],
    };
    const supabase = createDunningSupabase(state);
    const service = new BillingService(
      supabase as never,
      mockGateway({ cancelSubscription }),
    );

    const first = await service.processExpiredGracePeriods();
    expect(cancelSubscription).toHaveBeenCalledWith('sub_stripe_1', false);
    expect(first.processed).toBe(1);
    expect(expired.status).toBe('canceled');
    expect(supabase.companyUpdates.some((u) => u.subscription_tier === 'free')).toBe(
      true,
    );

    // Simulate DB already canceled — query returns nothing
    state.expiredQuery = [];
    const second = await service.processExpiredGracePeriods();
    expect(second.processed).toBe(0);
    expect(cancelSubscription).toHaveBeenCalledTimes(1);
  });
});

describe('stripe normalizer trial_will_end + invoice period', () => {
  it('maps customer.subscription.trial_will_end', () => {
    const normalizer = new StripeWebhookNormalizer('sk_test_xxx');
    const normalized = normalizer.normalize({
      id: 'evt_trial',
      type: 'customer.subscription.trial_will_end',
      created: 1_700_000_000,
      data: {
        object: {
          id: 'sub_1',
          customer: 'cus_1',
          status: 'trialing',
          metadata: { user_id: 'user-1' },
          items: { data: [{ quantity: 1, price: { id: 'price_1' } }] },
          current_period_start: 1_700_000_000,
          current_period_end: 1_700_086_400,
          cancel_at_period_end: false,
        },
      },
    });
    expect(normalized?.type).toBe('subscription.trial_will_end');
  });

  it('extracts invoice line period on invoice.paid', () => {
    const normalizer = new StripeWebhookNormalizer('sk_test_xxx');
    const normalized = normalizer.normalize({
      id: 'evt_inv',
      type: 'invoice.paid',
      created: 1_700_000_000,
      data: {
        object: {
          id: 'in_1',
          customer: 'cus_1',
          subscription: 'sub_1',
          currency: 'usd',
          status: 'paid',
          amount_paid: 1499,
          created: 1_700_000_000,
          lines: {
            data: [{ period: { start: 1_700_000_000, end: 1_700_259_200 } }],
          },
          status_transitions: { paid_at: 1_700_000_100 },
        },
      },
    });
    expect(normalized?.type).toBe('invoice.paid');
    const data = normalized?.data as InvoiceEventData;
    expect(data.periodStart).toBe(new Date(1_700_000_000 * 1000).toISOString());
    expect(data.periodEnd).toBe(new Date(1_700_259_200 * 1000).toISOString());
  });
});
