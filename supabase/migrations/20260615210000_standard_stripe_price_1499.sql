-- Link plan_necessary_month (Standard, $14.99/technician/month) to Stripe price.
-- Created in Stripe test mode: product prod_UiBdKitgbOMRCy, price price_1TilGTE3O31AtXXLolNt2YKj

UPDATE public.cadenza_billing_plans
SET
  provider_price_map = jsonb_set(
    COALESCE(provider_price_map, '{}'::jsonb),
    '{stripe}',
    '"price_1TilGTE3O31AtXXLolNt2YKj"'::jsonb
  ),
  updated_at = now()
WHERE id = 'plan_necessary_month';
