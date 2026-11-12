/**
 * Internal plan ID -> Stripe price lookup key.
 * Checkout, plan changes, and webhook reverse-mapping share these keys so
 * Stripe prices are resolved without trusting stale provider_price_map IDs.
 *
 * Per-plan env override: STRIPE_LOOKUP_KEY_<planId>
 * e.g. STRIPE_LOOKUP_KEY_plan_necessary_month=cadenza_standard_monthly
 */

/** Default lookup keys checked into source control */
export const STRIPE_LOOKUP_KEYS: Record<string, string> = {
  plan_necessary_month: 'cadenza_standard_monthly',
  plan_pro_month: 'cadenza_pro_monthly',
  plan_necessary_year: 'cadenza_standard_yearly',
  plan_premium_month: 'cadenza_premium_monthly',
  plan_premium_year: 'cadenza_premium_yearly',
};

/**
 * Resolve the Stripe lookup key for a plan, honoring env overrides.
 */
export function getStripeLookupKey(planId: string): string | undefined {
  const envOverride = process.env[`STRIPE_LOOKUP_KEY_${planId}`]?.trim();
  if (envOverride) {
    return envOverride;
  }
  return STRIPE_LOOKUP_KEYS[planId];
}

/**
 * Map a Stripe price lookup_key back to an internal plan id.
 */
export function planIdFromStripeLookupKey(lookupKey: string): string | undefined {
  for (const planId of Object.keys(STRIPE_LOOKUP_KEYS)) {
    if (getStripeLookupKey(planId) === lookupKey) {
      return planId;
    }
  }
  return undefined;
}
