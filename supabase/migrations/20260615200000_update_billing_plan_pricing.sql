-- Update Free and Necessary (paid) plan pricing and feature limits.
-- Pricing model: flat monthly rate (amount_cents on plan row); feature gates in JSONB.
-- -1 = unlimited

UPDATE public.cadenza_billing_plans
SET
  amount_cents = 0,
  active = true,
  features = '{
    "admin_users": 10,
    "max_technicians": -1,
    "max_properties": 5000,
    "max_routes": -1,
    "max_service_jobs": -1,
    "max_photos_per_service": 5,
    "storage_gb": 5,
    "photo_retention_days": 365,
    "trial_days": 0,
    "priority_support": false,
    "advanced_analytics": false,
    "api_access": false,
    "custom_branding": false,
    "automated_scheduling": false,
    "real_time_gps_tracking": false,
    "sso_saml": false,
    "dedicated_account_manager": false
  }'::jsonb,
  updated_at = now()
WHERE id = 'plan_free';

-- Necessary = primary paid tier at $14.99/month
UPDATE public.cadenza_billing_plans
SET
  name = 'Standard',
  amount_cents = 1499,
  active = true,
  features = '{
    "admin_users": 10,
    "max_technicians": -1,
    "max_properties": -1,
    "max_routes": -1,
    "max_service_jobs": -1,
    "max_photos_per_service": 10,
    "storage_gb": 50,
    "photo_retention_days": 1825,
    "trial_days": 0,
    "priority_support": true,
    "advanced_analytics": false,
    "api_access": false,
    "custom_branding": false,
    "automated_scheduling": false,
    "real_time_gps_tracking": false,
    "sso_saml": false,
    "dedicated_account_manager": false
  }'::jsonb,
  updated_at = now()
WHERE id = 'plan_necessary_month';

-- Deactivate legacy Premium tier until redefined
UPDATE public.cadenza_billing_plans
SET active = false, updated_at = now()
WHERE id IN ('plan_premium_month', 'plan_premium_year', 'plan_necessary_year');
