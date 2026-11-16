/**
 * ensureFreeSubscription — idempotent Free row creation
 */

import { BillingService } from '../billing.service';
import type { PaymentGateway } from '../gateway.interface';

function mockGateway(): PaymentGateway {
  return {
    getName: () => 'stripe',
    createCustomer: jest.fn(),
    attachPaymentMethod: jest.fn(),
    setDefaultPaymentMethod: jest.fn(),
    detachPaymentMethod: jest.fn(),
    createSubscription: jest.fn(),
    updateSubscription: jest.fn(),
    cancelSubscription: jest.fn(),
    createCheckoutSession: jest.fn(),
    createPortalSession: jest.fn(),
    getInvoices: jest.fn(),
    constructWebhookEvent: jest.fn(),
  } as unknown as PaymentGateway;
}

describe('BillingService.ensureFreeSubscription', () => {
  it('returns existing free subscription without inserting', async () => {
    const existing = {
      id: 'sub-existing',
      user_id: 'user-1',
      plan_id: 'plan_free',
      status: 'active',
      provider: 'none',
      provider_subscription_id: 'free_user-1',
      quantity: 1,
      cancel_at_period_end: false,
      current_period_start: '2026-11-01T00:00:00.000Z',
      current_period_end: '2026-12-01T00:00:00.000Z',
      created_at: '2026-11-01T00:00:00.000Z',
      updated_at: '2026-11-01T00:00:00.000Z',
    };

    const insert = jest.fn();
    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'cadenza_billing_subscriptions') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                in: jest.fn(() => ({
                  order: jest.fn(() => ({
                    limit: jest.fn(() => ({
                      maybeSingle: jest.fn(async () => ({ data: existing, error: null })),
                    })),
                  })),
                })),
                maybeSingle: jest.fn(async () => ({ data: existing, error: null })),
              })),
            })),
            insert,
          };
        }
        return {};
      }),
    };

    const service = new BillingService(supabase as never, mockGateway());
    const result = await service.ensureFreeSubscription('user-1');

    expect(result.planId).toBe('plan_free');
    expect(result.id).toBe('sub-existing');
    expect(insert).not.toHaveBeenCalled();
  });

  it('inserts free row with current_period_end from plan_duration_days', async () => {
    const inserted = {
      id: 'sub-new',
      user_id: 'user-2',
      plan_id: 'plan_free',
      status: 'active',
      provider: 'none',
      provider_subscription_id: 'free_user-2',
      quantity: 1,
      cancel_at_period_end: false,
      current_period_start: '2026-11-13T00:00:00.000Z',
      current_period_end: '2026-12-13T00:00:00.000Z',
      created_at: '2026-11-13T00:00:00.000Z',
      updated_at: '2026-11-13T00:00:00.000Z',
    };

    type FreeInsertRow = {
      plan_id: string;
      status: string;
      provider: string;
      provider_subscription_id: string;
      current_period_end: string;
    };

    const insert = jest.fn((_row: FreeInsertRow) => ({
      select: jest.fn(() => ({
        single: jest.fn(async () => ({ data: inserted, error: null })),
      })),
    }));

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === 'cadenza_billing_subscriptions') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn((col: string) => {
                if (col === 'user_id') {
                  return {
                    in: jest.fn(() => ({
                      order: jest.fn(() => ({
                        limit: jest.fn(() => ({
                          maybeSingle: jest.fn(async () => ({ data: null, error: null })),
                        })),
                      })),
                    })),
                  };
                }
                return {
                  maybeSingle: jest.fn(async () => ({ data: null, error: null })),
                };
              }),
            })),
            insert,
            update: jest.fn(() => ({
              eq: jest.fn(async () => ({ error: null })),
            })),
          };
        }
        if (table === 'cadenza_billing_plans') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn(async () => ({
                  data: {
                    id: 'plan_free',
                    name: 'Free',
                    currency: 'USD',
                    amount_cents: 0,
                    interval: 'month',
                    features: { plan_duration_days: 30 },
                    provider_price_map: {},
                    pricing_model: 'flat',
                  },
                  error: null,
                })),
              })),
            })),
          };
        }
        if (table === 'cadenza_profiles') {
          return {
            select: jest.fn(() => ({
              eq: jest.fn(() => ({
                maybeSingle: jest.fn(async () => ({ data: { company_id: 'co-1' }, error: null })),
              })),
            })),
          };
        }
        if (table === 'cadenza_companies') {
          return {
            update: jest.fn(() => ({
              eq: jest.fn(async () => ({ error: null })),
            })),
          };
        }
        return {};
      }),
    };

    const service = new BillingService(supabase as never, mockGateway());
    const result = await service.ensureFreeSubscription('user-2');

    expect(insert).toHaveBeenCalled();
    const [[payload]] = insert.mock.calls as [[FreeInsertRow]];
    expect(payload.plan_id).toBe('plan_free');
    expect(payload.status).toBe('active');
    expect(payload.provider).toBe('none');
    expect(payload.provider_subscription_id).toBe('free_user-2');
    expect(payload.current_period_end).toBeTruthy();
    expect(result.id).toBe('sub-new');
  });
});
