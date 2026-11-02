/**
 * Internal plan ID -> Stripe price lookup key.
 * Shared by Checkout and plan changes so both resolve the same current price.
 */
export const STRIPE_LOOKUP_KEYS: Record<string, string> = {
  plan_necessary_month: 'cadenza_standard_monthly',
  plan_pro_month: 'cadenza_pro_monthly',
};
