-- ALREADY APPLIED in the shared DB — record-only; do not re-apply manually.
-- Extends cadenza_companies.subscription_tier CHECK to include 'standard'
-- and backfills tier from the payer's active billing subscription.

-- Postgres names inline CHECKs as {table}_{column}_check; drop IF EXISTS in case
-- the live name differs slightly from older dumps.
ALTER TABLE public.cadenza_companies
  DROP CONSTRAINT IF EXISTS cadenza_companies_subscription_tier_check;

ALTER TABLE public.cadenza_companies
  ADD CONSTRAINT cadenza_companies_subscription_tier_check
  CHECK (subscription_tier IN ('free', 'standard', 'pro', 'enterprise'));

-- Backfill from latest active sub for company payer (owner or admin).
UPDATE public.cadenza_companies c
SET
  subscription_tier = CASE s.plan_id
    WHEN 'plan_free' THEN 'free'
    WHEN 'plan_necessary_month' THEN 'standard'
    WHEN 'plan_necessary_year' THEN 'standard'
    WHEN 'plan_pro_month' THEN 'pro'
    WHEN 'plan_premium_month' THEN 'pro'
    WHEN 'plan_premium_year' THEN 'pro'
    ELSE c.subscription_tier
  END,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (p.company_id)
    p.company_id,
    sub.plan_id
  FROM public.cadenza_billing_subscriptions sub
  JOIN public.cadenza_profiles p
    ON p.id = sub.user_id
   AND p.role IN ('owner', 'admin')
  WHERE sub.status IN ('active', 'trialing', 'past_due')
  ORDER BY p.company_id, sub.created_at DESC
) s
WHERE c.id = s.company_id
  AND c.subscription_tier IS DISTINCT FROM CASE s.plan_id
    WHEN 'plan_free' THEN 'free'
    WHEN 'plan_necessary_month' THEN 'standard'
    WHEN 'plan_necessary_year' THEN 'standard'
    WHEN 'plan_pro_month' THEN 'pro'
    WHEN 'plan_premium_month' THEN 'pro'
    WHEN 'plan_premium_year' THEN 'pro'
    ELSE c.subscription_tier
  END;
