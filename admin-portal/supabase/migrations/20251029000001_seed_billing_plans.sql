-- Seed initial billing plans
-- These plans define the subscription tiers for the caicos platform
-- Free Plan
INSERT INTO public.caicos_billing_plans
    (
        id          ,
        name        ,
        currency    ,
        amount_cents,
        interval    ,
        features    ,
        provider_price_map
    )
VALUES
    (
    'plan_free',
    'Free' ,
    'USD'  ,
    0      ,
    'month',
    '{
    "admin_users_included": 5,
    "max_technicians": 3,
    "max_properties": 300,
    "max_routes": 10,
    "max_service_jobs": -1,
    "max_photos_per_service": 2,
    "storage_gb": 5,
    "photo_retention_days": 30,
    "trial_days": 90,
    "priority_support": false,
    "advanced_analytics": false,
    "api_access": false,
    "custom_branding": false,
    "automated_scheduling": false,
    "real_time_gps_tracking": false,
    "sso_saml": false,
    "dedicated_account_manager": false
  }'::jsonb,
    '{
    "stripe": "price_free_monthly",
    "paypal": "PLAN-FREE-MONTHLY",
    "wompi": "free_monthly",
    "payu": "FREE-MONTHLY"
  }'::jsonb
    )
    ON CONFLICT
    (
        id
    )
    DO NOTHING;
-- Necessary Plan - Monthly
INSERT INTO public.caicos_billing_plans
    (
        id          ,
        name        ,
        currency    ,
        amount_cents,
        interval    ,
        features    ,
        provider_price_map
    )
VALUES
    (
        'plan_necessary_month'                                                                                                                                                                 ,
        'Necessary'                                                                                                                                                                            ,
        'USD'                                                                                                                                                                                  ,
        999                                                                                                                                                                                    ,
        'month'                                                                                                                                                                                ,
       '{
    "admin_users_included": 10,
    "max_technicians": 100,
    "max_properties": 3000,
    "max_routes": 50,
    "max_service_jobs": -1,
    "max_photos_per_service": 10,
    "storage_gb": 10,
    "photo_retention_days": 90,
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
        '{
    "stripe": "price_necessary_month",
    "paypal": "PLAN-NECESSARY-MONTH",
    "wompi": "necessary_month",
    "payu": "NECESSARY-MONTH"
  }'::jsonb
    )
    ON CONFLICT
    (
        id
    )
    DO NOTHING;
-- Necessary Plan - Yearly
INSERT INTO public.caicos_billing_plans
    (
        id          ,
        name        ,
        currency    ,
        amount_cents,
        interval    ,
        features    ,
        provider_price_map
    )
VALUES
    (
        'plan_necessary_year'                                                                                                                                                                  ,
        'Necessary'                                                                                                                                                                            ,
        'USD'                                                                                                                                                                                  ,
        9999                                                                                                                                                                                   ,
        'year'                                                                                                                                                                                 ,
        '{
    "admin_users_included": 10,
    "max_technicians": 100,
    "max_properties": 3000,
    "max_routes": 50,
    "max_service_jobs": -1,
    "max_photos_per_service": 10,
    "storage_gb": 10,
    "photo_retention_days": 90,
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
        '{
    "stripe": "price_necessary_year_pooldash",
    "paypal": "PLAN-NECESSARY-YEAR",
    "wompi": "necessary_year",
    "payu": "NECESSARY-YEAR"
  }'::jsonb
    )
    ON CONFLICT
    (
        id
    )
    DO NOTHING;
-- Premium Plan - Monthly
INSERT INTO public.caicos_billing_plans
    (
        id          ,
        name        ,
        currency    ,
        amount_cents,
        interval    ,
        features    ,
        provider_price_map
    )
VALUES
    (
        'plan_premium_month'                                                                                                                                                                   ,
        'Premium'                                                                                                                                                                              ,
        'USD'                                                                                                                                                                                  ,
        3999                                                                                                                                                                                   ,
        'month'                                                                                                                                                                                ,
        '{
    "admin_users_included": -1,
    "max_technicians": 500,
    "max_properties": -1,
    "max_routes": -1,
    "max_service_jobs": -1,
    "max_photos_per_service": -1,
    "storage_gb": 500,
    "photo_retention_days": 365,
    "trial_days": 0,
    "priority_support": true,
    "advanced_analytics": true,
    "api_access": true,
    "custom_branding": true,
    "automated_scheduling": true,
    "real_time_gps_tracking": true,
    "sso_saml": true,
    "dedicated_account_manager": true
  }'::jsonb,
        '{
    "stripe": "price_premium_monthly",
    "paypal": "PLAN-PREMIUM-MONTHLY",
    "wompi": "premium_monthly",
    "payu": "PREMIUM-MONTHLY"
  }'::jsonb
    )
    ON CONFLICT
    (
        id
    )
    DO NOTHING;
-- Premium Plan - Yearly
INSERT INTO public.caicos_billing_plans
    (
        id          ,
        name        ,
        currency    ,
        amount_cents,
        interval    ,
        features    ,
        provider_price_map
    )
VALUES
    (
        'plan_premium_year'                                                                                                                                                                    ,
        'Premium'                                                                                                                                                                              ,
        'USD'                                                                                                                                                                                  ,
        39999                                                                                                                                                                                  ,
        'year'                                                                                                                                                                                 ,
        '{
    "admin_users_included": -1,
    "max_technicians": 500,
    "max_properties": -1,
    "max_routes": -1,
    "max_service_jobs": -1,
    "max_photos_per_service": -1,
    "storage_gb": 500,
    "photo_retention_days": 365,
    "trial_days": 0,
    "priority_support": true,
    "advanced_analytics": true,
    "api_access": true,
    "custom_branding": true,
    "automated_scheduling": true,
    "real_time_gps_tracking": true,
    "sso_saml": true,
    "dedicated_account_manager": true
  }'::jsonb,
        '{
    "stripe": "price_premium_yearly",
    "paypal": "PLAN-PREMIUM-YEARLY",
    "wompi": "premium_yearly",
    "payu": "PREMIUM-YEARLY"
  }'::jsonb
    )
    ON CONFLICT
    (
        id
    )
    DO NOTHING;
-- Note: -1 in features indicates "unlimited"
-- Provider price IDs are placeholders and should be updated with actual IDs from each payment provider