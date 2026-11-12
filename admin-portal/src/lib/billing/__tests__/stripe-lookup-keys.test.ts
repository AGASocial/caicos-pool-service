import {
  STRIPE_LOOKUP_KEYS,
  getStripeLookupKey,
  planIdFromStripeLookupKey,
} from '../stripe-lookup-keys';

describe('stripe-lookup-keys', () => {
  const overrideEnvKeys = [
    'STRIPE_LOOKUP_KEY_plan_necessary_month',
    'STRIPE_LOOKUP_KEY_plan_pro_month',
  ] as const;
  const originals: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of overrideEnvKeys) {
      originals[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of overrideEnvKeys) {
      if (originals[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = originals[key];
      }
    }
  });

  it('maps active monthly plans to cadenza_<tier>_monthly keys', () => {
    expect(STRIPE_LOOKUP_KEYS.plan_necessary_month).toBe('cadenza_standard_monthly');
    expect(STRIPE_LOOKUP_KEYS.plan_pro_month).toBe('cadenza_pro_monthly');
  });

  it('maps year/premium variants to cadenza_<tier>_yearly|monthly keys', () => {
    expect(STRIPE_LOOKUP_KEYS.plan_necessary_year).toBe('cadenza_standard_yearly');
    expect(STRIPE_LOOKUP_KEYS.plan_premium_month).toBe('cadenza_premium_monthly');
    expect(STRIPE_LOOKUP_KEYS.plan_premium_year).toBe('cadenza_premium_yearly');
  });

  it('allows per-plan env overrides', () => {
    process.env.STRIPE_LOOKUP_KEY_plan_necessary_month = 'custom_standard_monthly';
    expect(getStripeLookupKey('plan_necessary_month')).toBe('custom_standard_monthly');
    expect(getStripeLookupKey('plan_pro_month')).toBe('cadenza_pro_monthly');
  });

  it('reverse-maps lookup keys to plan ids (honoring overrides)', () => {
    expect(planIdFromStripeLookupKey('cadenza_pro_monthly')).toBe('plan_pro_month');
    process.env.STRIPE_LOOKUP_KEY_plan_pro_month = 'custom_pro';
    expect(planIdFromStripeLookupKey('custom_pro')).toBe('plan_pro_month');
    expect(planIdFromStripeLookupKey('unknown_key')).toBeUndefined();
  });
});
