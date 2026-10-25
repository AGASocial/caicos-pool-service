-- Data-driven billing tiers with per-technician pricing
-- Add pricing_model column and create Pro plan

-- Add pricing_model column to billing plans
ALTER TABLE public.cadenza_billing_plans
  ADD COLUMN IF NOT EXISTS pricing_model text DEFAULT 'flat' CHECK (pricing_model IN ('flat', 'per_technician'));

COMMENT ON COLUMN public.cadenza_billing_plans.pricing_model IS 'Pricing model: flat (amount_cents is total) or per_technician (amount_cents × quantity)';

-- Update Free plan with correct limits and flat pricing
UPDATE public.cadenza_billing_plans
SET
  name = 'Free',
  amount_cents = 0,
  pricing_model = 'flat',
  active = true,
  features = jsonb_build_object(
    'admin_users', 1,
    'max_technicians', 3,
    'max_photos_per_service', 2,
    'photo_retention_days', 30,
    'photo_hot_storage_days', 30,
    'photo_archive_provider', null,
    'report_history_days', 90,
    'plan_duration_days', 90,
    'video_per_service', false,
    'max_video_seconds', 0,
    'data_export', false,
    'advanced_analytics', false,
    'storage_gb', 5,
    'priority_support', false,
    'api_access', false,
    'custom_branding', false,
    'max_properties', 300,
    'max_routes', 10,
    'max_service_jobs', -1,
    'automated_scheduling', false,
    'real_time_gps_tracking', false,
    'sso_saml', false,
    'dedicated_account_manager', false
  ),
  updated_at = now()
WHERE id = 'plan_free';

-- Update Standard plan (formerly Necessary) with per-technician pricing at $14.99
UPDATE public.cadenza_billing_plans
SET
  name = 'Standard',
  amount_cents = 1499,
  pricing_model = 'per_technician',
  active = true,
  features = jsonb_build_object(
    'admin_users', -1,
    'max_technicians', -1,
    'max_photos_per_service', 10,
    'photo_retention_days', 1825,
    'photo_hot_storage_days', 30,
    'photo_archive_provider', 'r2',
    'report_history_days', -1,
    'plan_duration_days', null,
    'video_per_service', false,
    'max_video_seconds', 0,
    'data_export', false,
    'advanced_analytics', false,
    'storage_gb', 50,
    'priority_support', true,
    'api_access', false,
    'custom_branding', false,
    'max_properties', -1,
    'max_routes', -1,
    'max_service_jobs', -1,
    'automated_scheduling', false,
    'real_time_gps_tracking', false,
    'sso_saml', false,
    'dedicated_account_manager', false
  ),
  updated_at = now()
WHERE id = 'plan_necessary_month';

-- Deactivate legacy yearly and old premium plans
UPDATE public.cadenza_billing_plans
SET active = false, updated_at = now()
WHERE id IN ('plan_necessary_year', 'plan_premium_month', 'plan_premium_year');

-- Insert new Pro plan at $24.99 per technician per month
INSERT INTO public.cadenza_billing_plans (
  id,
  name,
  currency,
  amount_cents,
  interval,
  pricing_model,
  active,
  features,
  provider_price_map
)
VALUES (
  'plan_pro_month',
  'Pro',
  'USD',
  2499,
  'month',
  'per_technician',
  true,
  jsonb_build_object(
    'admin_users', -1,
    'max_technicians', -1,
    'max_photos_per_service', 20,
    'photo_retention_days', 2555,
    'photo_hot_storage_days', 30,
    'photo_archive_provider', 'r2',
    'report_history_days', -1,
    'plan_duration_days', null,
    'video_per_service', true,
    'max_video_seconds', 60,
    'data_export', true,
    'advanced_analytics', true,
    'storage_gb', 100,
    'priority_support', true,
    'api_access', true,
    'custom_branding', true,
    'max_properties', -1,
    'max_routes', -1,
    'max_service_jobs', -1,
    'automated_scheduling', true,
    'real_time_gps_tracking', true,
    'sso_saml', false,
    'dedicated_account_manager', false
  ),
  jsonb_build_object(
    'stripe', 'price_pro_monthly',
    'paypal', 'PLAN-PRO-MONTHLY',
    'wompi', 'pro_monthly',
    'payu', 'PRO-MONTHLY'
  )
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  amount_cents = EXCLUDED.amount_cents,
  pricing_model = EXCLUDED.pricing_model,
  active = EXCLUDED.active,
  features = EXCLUDED.features,
  updated_at = now();

-- Handle existing subscription on inactive plan_premium_month
-- Map it to Pro-equivalent features by updating plan_id
UPDATE public.cadenza_billing_subscriptions
SET plan_id = 'plan_pro_month', updated_at = now()
WHERE plan_id = 'plan_premium_month' AND status IN ('active', 'trialing', 'past_due');

COMMENT ON COLUMN public.cadenza_billing_plans.features IS 'JSONB feature limits. -1 = unlimited, null = not applicable. Keys: admin_users, max_technicians, max_photos_per_service, photo_retention_days, photo_hot_storage_days, photo_archive_provider, report_history_days, plan_duration_days, video_per_service, max_video_seconds, data_export, advanced_analytics, etc.';
