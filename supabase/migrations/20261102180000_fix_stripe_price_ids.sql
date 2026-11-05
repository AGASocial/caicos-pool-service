-- Point Standard/Pro plans at the current Stripe per-seat monthly prices
-- (lookup keys cadenza_standard_monthly $14.99, cadenza_pro_monthly $24.99).
-- Already applied manually to project ejhrfnauifgvopshnnuv on 2026-11-02 (approved by Gabriel);
-- idempotent so re-running is a no-op. Only the "stripe" key of provider_price_map is touched.
-- NOTE: these are Stripe TEST-mode price IDs; update when switching to live mode.

update public.cadenza_billing_plans
set provider_price_map = jsonb_set(coalesce(provider_price_map, '{}'::jsonb), '{stripe}', '"price_1UUWWsE3O31AtXXL8mko2f66"')
where id = 'plan_necessary_month'
  and provider_price_map->>'stripe' is distinct from 'price_1UUWWsE3O31AtXXL8mko2f66';

update public.cadenza_billing_plans
set provider_price_map = jsonb_set(coalesce(provider_price_map, '{}'::jsonb), '{stripe}', '"price_1UUWWtE3O31AtXXLASD3YkGe"')
where id = 'plan_pro_month'
  and provider_price_map->>'stripe' is distinct from 'price_1UUWWtE3O31AtXXLASD3YkGe';
