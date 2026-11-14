import { mapPlanToTier, SUBSCRIPTION_TIERS } from '../subscription-tier';

describe('mapPlanToTier', () => {
  it('maps free plan to free', () => {
    expect(mapPlanToTier('plan_free')).toBe('free');
  });

  it('maps necessary (standard) month and year to standard', () => {
    expect(mapPlanToTier('plan_necessary_month')).toBe('standard');
    expect(mapPlanToTier('plan_necessary_year')).toBe('standard');
  });

  it('maps pro and premium plans to pro', () => {
    expect(mapPlanToTier('plan_pro_month')).toBe('pro');
    expect(mapPlanToTier('plan_premium_month')).toBe('pro');
    expect(mapPlanToTier('plan_premium_year')).toBe('pro');
  });

  it('returns null for unknown plan ids (leave enterprise / custom alone)', () => {
    expect(mapPlanToTier('plan_enterprise')).toBeNull();
    expect(mapPlanToTier('unknown')).toBeNull();
    expect(mapPlanToTier('')).toBeNull();
  });

  it('exposes allowed tier values matching the DB CHECK', () => {
    expect([...SUBSCRIPTION_TIERS]).toEqual(['free', 'standard', 'pro', 'enterprise']);
  });
});
