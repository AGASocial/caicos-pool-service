/**
 * Unit tests for Stripe lookup_key price resolution + cache + fallback.
 */

import { StripeAdapter } from '../stripe.adapter';
import { clearStripePriceCache } from '../../stripe-price-cache';

const listMock = jest.fn();
const retrieveMock = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    prices: {
      list: (...args: unknown[]) => listMock(...args),
      retrieve: (...args: unknown[]) => retrieveMock(...args),
    },
    customers: { create: jest.fn(), list: jest.fn(), update: jest.fn() },
    subscriptions: { create: jest.fn(), update: jest.fn(), retrieve: jest.fn(), cancel: jest.fn() },
    checkout: { sessions: { create: jest.fn() } },
    billingPortal: { sessions: { create: jest.fn() } },
    invoices: { list: jest.fn(), retrieve: jest.fn(), pay: jest.fn() },
    paymentMethods: { attach: jest.fn(), detach: jest.fn() },
  }));
});

describe('StripeAdapter price resolution', () => {
  let adapter: StripeAdapter;

  beforeEach(() => {
    clearStripePriceCache();
    listMock.mockReset();
    retrieveMock.mockReset();
    adapter = new StripeAdapter('sk_test_xxx');
  });

  describe('resolvePriceByLookupKey', () => {
    it('lists active prices by lookup_keys and caches the result', async () => {
      listMock.mockResolvedValueOnce({
        data: [{ id: 'price_live_123', lookup_key: 'cadenza_standard_monthly' }],
      });

      await expect(adapter.resolvePriceByLookupKey('cadenza_standard_monthly')).resolves.toBe(
        'price_live_123'
      );
      expect(listMock).toHaveBeenCalledWith({
        lookup_keys: ['cadenza_standard_monthly'],
        active: true,
        limit: 1,
      });

      // Second call should hit cache
      await expect(adapter.resolvePriceByLookupKey('cadenza_standard_monthly')).resolves.toBe(
        'price_live_123'
      );
      expect(listMock).toHaveBeenCalledTimes(1);
    });

    it('returns null when no active price exists for the lookup key', async () => {
      listMock.mockResolvedValueOnce({ data: [] });
      await expect(adapter.resolvePriceByLookupKey('missing_key')).resolves.toBeNull();
    });
  });

  describe('resolveStripePriceId', () => {
    it('prefers lookup_key resolution over the stored price id', async () => {
      listMock.mockResolvedValueOnce({
        data: [{ id: 'price_from_lookup' }],
      });

      await expect(
        adapter.resolveStripePriceId('plan_necessary_month', 'price_stored_stale')
      ).resolves.toBe('price_from_lookup');
    });

    it('falls back to the stored price id when lookup key has no price', async () => {
      listMock.mockResolvedValueOnce({ data: [] });

      await expect(
        adapter.resolveStripePriceId('plan_necessary_month', 'price_test_fallback')
      ).resolves.toBe('price_test_fallback');
    });

    it('returns null when neither lookup nor stored id is available', async () => {
      listMock.mockResolvedValueOnce({ data: [] });
      await expect(adapter.resolveStripePriceId('plan_necessary_month')).resolves.toBeNull();
    });
  });

  describe('getLookupKeyForPriceId', () => {
    it('retrieves lookup_key from Stripe and caches reverse mapping', async () => {
      retrieveMock.mockResolvedValueOnce({
        id: 'price_abc',
        lookup_key: 'cadenza_pro_monthly',
      });

      await expect(adapter.getLookupKeyForPriceId('price_abc')).resolves.toBe(
        'cadenza_pro_monthly'
      );
      expect(retrieveMock).toHaveBeenCalledWith('price_abc');

      // Reverse cache: resolving by lookup key should not call list
      await expect(adapter.resolvePriceByLookupKey('cadenza_pro_monthly')).resolves.toBe(
        'price_abc'
      );
      expect(listMock).not.toHaveBeenCalled();
    });
  });
});
