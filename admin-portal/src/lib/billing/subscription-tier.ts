/**
 * Map billing plan ids to cadenza_companies.subscription_tier values.
 * Pure / side-effect free — keep in sync with DB CHECK constraint.
 */

export const SUBSCRIPTION_TIERS = ['free', 'standard', 'pro', 'enterprise'] as const;

export type SubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

/**
 * Returns the company subscription_tier for a known plan id, or null if unmapped
 * (e.g. enterprise-only / unknown plans — do not overwrite the column).
 */
export function mapPlanToTier(planId: string): SubscriptionTier | null {
  switch (planId) {
    case 'plan_free':
      return 'free';
    case 'plan_necessary_month':
    case 'plan_necessary_year':
      return 'standard';
    case 'plan_pro_month':
    case 'plan_premium_month':
    case 'plan_premium_year':
      return 'pro';
    default:
      return null;
  }
}
