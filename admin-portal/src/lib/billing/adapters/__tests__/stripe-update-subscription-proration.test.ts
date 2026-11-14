/**
 * StripeAdapter.updateSubscription must send explicit proration_behavior for quantity changes.
 */

import { StripeAdapter } from '../stripe.adapter';

const retrieveMock = jest.fn();
const updateMock = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    prices: { list: jest.fn(), retrieve: jest.fn() },
    customers: { create: jest.fn(), list: jest.fn(), update: jest.fn() },
    subscriptions: {
      create: jest.fn(),
      update: (...args: unknown[]) => updateMock(...args),
      retrieve: (...args: unknown[]) => retrieveMock(...args),
      cancel: jest.fn(),
    },
    checkout: { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
    invoices: { list: jest.fn(), retrieve: jest.fn(), pay: jest.fn() },
    paymentMethods: { attach: jest.fn(), detach: jest.fn() },
  }));
});

describe('StripeAdapter.updateSubscription proration_behavior', () => {
  let adapter: StripeAdapter;

  beforeEach(() => {
    retrieveMock.mockReset();
    updateMock.mockReset();
    adapter = new StripeAdapter('sk_test_xxx');

    retrieveMock.mockResolvedValue({
      id: 'sub_1',
      items: { data: [{ id: 'si_1', price: { id: 'price_1' } }] },
      metadata: {},
      status: 'active',
      billing_cycle_anchor: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
      current_period_start: Math.floor(Date.now() / 1000),
    });

    updateMock.mockResolvedValue({
      id: 'sub_1',
      status: 'active',
      items: {
        data: [
          {
            price: { id: 'price_1', recurring: { interval: 'month', interval_count: 1 } },
          },
        ],
      },
      billing_cycle_anchor: Math.floor(Date.now() / 1000),
      current_period_end: Math.floor(Date.now() / 1000) + 86400,
      current_period_start: Math.floor(Date.now() / 1000),
    });
  });

  it('requires prorationBehavior when quantity is set', async () => {
    await expect(
      adapter.updateSubscription('sub_1', { quantity: 4 })
    ).rejects.toThrow(/prorationBehavior is required/);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('passes create_prorations for seat increases', async () => {
    await adapter.updateSubscription('sub_1', {
      quantity: 4,
      prorationBehavior: 'create_prorations',
    });

    expect(updateMock).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ id: 'si_1', quantity: 4 }],
        proration_behavior: 'create_prorations',
      })
    );
  });

  it('passes none for seat decreases (no credit)', async () => {
    await adapter.updateSubscription('sub_1', {
      quantity: 2,
      prorationBehavior: 'none',
    });

    expect(updateMock).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({
        items: [{ id: 'si_1', quantity: 2 }],
        proration_behavior: 'none',
      })
    );
  });

  it('does not require prorationBehavior for cancel_at_period_end only', async () => {
    await adapter.updateSubscription('sub_1', { cancelAtPeriodEnd: true });
    expect(updateMock).toHaveBeenCalledWith(
      'sub_1',
      expect.objectContaining({ cancel_at_period_end: true })
    );
    expect(updateMock.mock.calls[0][1].proration_behavior).toBeUndefined();
  });
});
