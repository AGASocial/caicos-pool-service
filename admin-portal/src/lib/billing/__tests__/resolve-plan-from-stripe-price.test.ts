/**
 * Tests webhook-facing plan resolution: price id -> lookup_key -> plan id,
 * with provider_price_map fallback.
 */

import { BillingService } from '../billing.service';
import type { PaymentGateway } from '../gateway.interface';

function createSupabaseMock(plans: Array<{ id: string; provider_price_map: Record<string, string> | null }>) {
  return {
    from: jest.fn(() => ({
      select: jest.fn(() =>
        Promise.resolve({ data: plans, error: null })
      ),
    })),
  };
}

describe('BillingService.resolvePlanIdFromStripePrice', () => {
  it('maps price id to plan via Stripe lookup_key', async () => {
    const getLookupKeyForPriceId = jest.fn().mockResolvedValue('cadenza_pro_monthly');
    const gateway = {
      getName: () => 'stripe' as const,
      getLookupKeyForPriceId,
    } as unknown as PaymentGateway;

    const supabase = createSupabaseMock([]);
    const service = new BillingService(supabase as never, gateway);

    const planId = await (
      service as unknown as {
        resolvePlanIdFromStripePrice: (id: string) => Promise<string | undefined>;
      }
    ).resolvePlanIdFromStripePrice('price_pro_live');

    expect(getLookupKeyForPriceId).toHaveBeenCalledWith('price_pro_live');
    expect(planId).toBe('plan_pro_month');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('falls back to provider_price_map when lookup_key is missing', async () => {
    const getLookupKeyForPriceId = jest.fn().mockResolvedValue(null);
    const gateway = {
      getName: () => 'stripe' as const,
      getLookupKeyForPriceId,
    } as unknown as PaymentGateway;

    const supabase = createSupabaseMock([
      { id: 'plan_necessary_month', provider_price_map: { stripe: 'price_test_std' } },
      { id: 'plan_pro_month', provider_price_map: null },
    ]);
    const service = new BillingService(supabase as never, gateway);

    const planId = await (
      service as unknown as {
        resolvePlanIdFromStripePrice: (id: string) => Promise<string | undefined>;
      }
    ).resolvePlanIdFromStripePrice('price_test_std');

    expect(planId).toBe('plan_necessary_month');
  });
});
