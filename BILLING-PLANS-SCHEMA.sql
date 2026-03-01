-- CAICOS Billing Plans Schema
-- Purpose: Define subscription tiers and enforce feature limits
-- Date: 2026-03-01
-- Status: Ready for implementation

-- ============================================================================
-- 1. BILLING PLANS TABLE (Reference data)
-- ============================================================================

CREATE TABLE IF NOT EXISTS caicos_billing_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  price_per_tech NUMERIC(10, 2) NOT NULL,
  billing_period TEXT NOT NULL DEFAULT 'month', -- 'month' or 'year'
  trial_days INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  display_order INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- 2. PLAN FEATURE LIMITS TABLE (Define limits per plan)
-- ============================================================================

CREATE TABLE IF NOT EXISTS caicos_plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES caicos_billing_plans(id) ON DELETE CASCADE,

  -- Team size limit (applies to all users: admins + technicians + anyone else)
  max_total_users INTEGER NOT NULL,

  -- Photo features
  max_photos_per_service INTEGER NOT NULL,
  photo_retention_days INTEGER NOT NULL,
  photo_storage_gb NUMERIC(10, 2) NOT NULL,

  -- Service job limits (monthly)
  max_service_jobs_per_month INTEGER NOT NULL,

  -- Properties/Routes
  max_properties INTEGER NOT NULL,

  -- Reporting & Analytics
  has_advanced_reports BOOLEAN DEFAULT FALSE,
  has_custom_fields BOOLEAN DEFAULT FALSE,
  has_api_access BOOLEAN DEFAULT FALSE,
  has_team_permissions BOOLEAN DEFAULT FALSE,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add unique constraint to prevent duplicate plan_id entries
ALTER TABLE caicos_plan_features ADD CONSTRAINT unique_plan_id UNIQUE (plan_id);

-- ============================================================================
-- 3. COMPANY SUBSCRIPTIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS caicos_company_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES caicos_companies(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES caicos_billing_plans(id),

  -- Billing details
  active_technicians INTEGER DEFAULT 0,
  monthly_cost NUMERIC(10, 2) NOT NULL,

  -- Subscription lifecycle
  started_at TIMESTAMPTZ DEFAULT NOW(),
  trial_ends_at TIMESTAMPTZ,
  billing_date_of_month INTEGER DEFAULT 1, -- Day of month to bill (1-28)

  -- Payment status
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'past_due', 'canceled', 'pending'
  auto_renew BOOLEAN DEFAULT TRUE,

  -- Cancellation
  canceled_at TIMESTAMPTZ,
  cancel_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_company_subscriptions_company_id ON caicos_company_subscriptions(company_id);

-- ============================================================================
-- 4. USAGE TRACKING TABLE (For monitoring limits)
-- ============================================================================

CREATE TABLE IF NOT EXISTS caicos_usage_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES caicos_companies(id) ON DELETE CASCADE,

  -- Monthly counts (reset on billing date)
  month_year TEXT NOT NULL, -- Format: 'YYYY-MM'
  service_jobs_completed INTEGER DEFAULT 0,
  photos_uploaded INTEGER DEFAULT 0,
  storage_used_gb NUMERIC(10, 2) DEFAULT 0,

  -- Current period
  reset_on TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_usage_tracking_company_month ON caicos_usage_tracking(company_id, month_year);

-- ============================================================================
-- 5. INSERT DEFAULT BILLING PLANS
-- ============================================================================

INSERT INTO caicos_billing_plans (name, slug, description, price_per_tech, trial_days, display_order)
VALUES
  (
    'Free Trial',
    'free-trial',
    'Full platform access for 3 months with team limit',
    0,
    90,
    1
  ),
  (
    'Growth',
    'growth',
    '$9.99 per technician/month - Perfect for scaling teams',
    9.99,
    0,
    2
  ),
  (
    'Premium',
    'premium',
    '$19.99 per technician/month - Unlimited everything',
    19.99,
    0,
    3
  )
ON CONFLICT (slug) DO NOTHING;

-- ============================================================================
-- 6. INSERT PLAN FEATURES
-- ============================================================================

-- FREE TRIAL PLAN (3-month full experience trial)
INSERT INTO caicos_plan_features (
  plan_id,
  max_total_users,
  max_photos_per_service,
  photo_retention_days,
  photo_storage_gb,
  max_service_jobs_per_month,
  max_properties,
  has_advanced_reports,
  has_custom_fields,
  has_api_access,
  has_team_permissions
)
SELECT
  id,
  10,          -- max 10 total users (admins + technicians, mixed as needed)
  2,           -- max 2 photos per service
  90,          -- 90-day retention
  0.5,         -- 500MB storage
  500,         -- 500 jobs/month (unlimited essentially for small team)
  50,          -- max 50 properties
  FALSE,       -- no advanced reports
  FALSE,       -- no custom fields
  FALSE,       -- no API
  FALSE        -- basic permissions only
FROM caicos_billing_plans
WHERE slug = 'free-trial'
ON CONFLICT (plan_id) DO NOTHING;

-- GROWTH PLAN ($9.99/tech)
INSERT INTO caicos_plan_features (
  plan_id,
  max_total_users,
  max_photos_per_service,
  photo_retention_days,
  photo_storage_gb,
  max_service_jobs_per_month,
  max_properties,
  has_advanced_reports,
  has_custom_fields,
  has_api_access,
  has_team_permissions
)
SELECT
  id,
  150,         -- max 150 total users (admins + technicians)
  10,          -- max 10 photos per service
  90,          -- 90-day retention (can upgrade to 180/unlimited for +$4.99/+$9.99)
  10,          -- 10GB storage
  2000,        -- 2000 jobs/month
  500,         -- max 500 properties
  TRUE,        -- advanced reports included
  FALSE,       -- custom fields available as add-on
  FALSE,       -- API as add-on
  TRUE         -- team permissions included
FROM caicos_billing_plans
WHERE slug = 'growth'
ON CONFLICT (plan_id) DO NOTHING;

-- PREMIUM PLAN ($19.99/tech)
INSERT INTO caicos_plan_features (
  plan_id,
  max_total_users,
  max_photos_per_service,
  photo_retention_days,
  photo_storage_gb,
  max_service_jobs_per_month,
  max_properties,
  has_advanced_reports,
  has_custom_fields,
  has_api_access,
  has_team_permissions
)
SELECT
  id,
  999999,      -- effectively unlimited users
  999999,      -- unlimited photos per service
  999999,      -- unlimited retention (we store indefinitely)
  999999,      -- unlimited storage
  999999,      -- unlimited jobs
  999999,      -- unlimited properties
  TRUE,        -- all reports
  TRUE,        -- custom fields
  TRUE,        -- API access
  TRUE         -- full permissions
FROM caicos_billing_plans
WHERE slug = 'premium'
ON CONFLICT (plan_id) DO NOTHING;

-- ============================================================================
-- 7. FUNCTION: Check if company can add more users
-- ============================================================================

CREATE OR REPLACE FUNCTION check_technician_limit(p_company_id UUID)
RETURNS TABLE (
  can_add_user BOOLEAN,
  current_count INTEGER,
  max_allowed INTEGER,
  plan_name TEXT,
  message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (COUNT(u.id)::INTEGER < COALESCE(pf.max_total_users, 999999))::BOOLEAN as can_add,
    COUNT(u.id)::INTEGER as current_count,
    COALESCE(pf.max_total_users, 999999) as max_allowed,
    bp.name as plan_name,
    CASE
      WHEN COUNT(u.id)::INTEGER >= COALESCE(pf.max_total_users, 999999)
        THEN 'User limit reached for ' || bp.name || ' plan (' || COALESCE(pf.max_total_users, 999999) || ' max)'
      ELSE 'OK'
    END as message
  FROM caicos_companies c
  LEFT JOIN caicos_company_subscriptions ccs ON c.id = ccs.company_id AND ccs.status = 'active'
  LEFT JOIN caicos_billing_plans bp ON ccs.plan_id = bp.id
  LEFT JOIN caicos_plan_features pf ON bp.id = pf.plan_id
  LEFT JOIN caicos_users u ON c.id = u.company_id
  WHERE c.id = p_company_id
  GROUP BY bp.name, pf.max_total_users;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 8. FUNCTION: Check if company can upload photo
-- ============================================================================

CREATE OR REPLACE FUNCTION check_photo_limit(
  p_company_id UUID,
  p_service_job_id UUID,
  p_new_photo_count INTEGER
)
RETURNS TABLE (
  can_upload BOOLEAN,
  current_count INTEGER,
  max_allowed INTEGER,
  message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (COUNT(sp.id)::INTEGER + p_new_photo_count <= COALESCE(pf.max_photos_per_service, 999999))::BOOLEAN as can_upload,
    COUNT(sp.id)::INTEGER as current_count,
    COALESCE(pf.max_photos_per_service, 999999) as max_allowed,
    CASE
      WHEN COUNT(sp.id)::INTEGER + p_new_photo_count > COALESCE(pf.max_photos_per_service, 999999)
        THEN 'Photo limit reached: ' || COALESCE(pf.max_photos_per_service, 999999) || ' max per service'
      ELSE 'OK'
    END as message
  FROM caicos_service_jobs csj
  LEFT JOIN caicos_service_photos sp ON csj.id = sp.service_job_id
  LEFT JOIN caicos_company_subscriptions ccs ON csj.company_id = ccs.company_id AND ccs.status = 'active'
  LEFT JOIN caicos_plan_features pf ON ccs.plan_id = pf.plan_id
  WHERE csj.id = p_service_job_id
  GROUP BY pf.max_photos_per_service;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 9. FUNCTION: Check if company has exceeded monthly job limit
-- ============================================================================

CREATE OR REPLACE FUNCTION check_monthly_job_limit(p_company_id UUID)
RETURNS TABLE (
  can_create_job BOOLEAN,
  jobs_this_month INTEGER,
  max_allowed INTEGER,
  message TEXT
) AS $$
DECLARE
  v_current_month TEXT;
  v_jobs_count INTEGER;
  v_max_jobs INTEGER;
BEGIN
  v_current_month := TO_CHAR(NOW(), 'YYYY-MM');

  SELECT COUNT(*)::INTEGER INTO v_jobs_count
  FROM caicos_service_jobs
  WHERE company_id = p_company_id
    AND TO_CHAR(created_at, 'YYYY-MM') = v_current_month;

  SELECT COALESCE(pf.max_service_jobs_per_month, 999999) INTO v_max_jobs
  FROM caicos_company_subscriptions ccs
  LEFT JOIN caicos_plan_features pf ON ccs.plan_id = pf.plan_id
  WHERE ccs.company_id = p_company_id
    AND ccs.status = 'active';

  RETURN QUERY
  SELECT
    (v_jobs_count < COALESCE(v_max_jobs, 999999))::BOOLEAN as can_create,
    v_jobs_count as jobs_this_month,
    COALESCE(v_max_jobs, 999999) as max_allowed,
    CASE
      WHEN v_jobs_count >= COALESCE(v_max_jobs, 999999)
        THEN 'Monthly job limit reached: ' || COALESCE(v_max_jobs, 999999) || ' jobs'
      ELSE 'OK'
    END as message;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 10. FUNCTION: Calculate monthly subscription cost
-- ============================================================================

CREATE OR REPLACE FUNCTION calculate_subscription_cost(
  p_company_id UUID,
  p_active_technicians INTEGER
)
RETURNS TABLE (
  plan_name TEXT,
  price_per_tech NUMERIC,
  active_techs INTEGER,
  monthly_cost NUMERIC,
  includes TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    bp.name,
    bp.price_per_tech,
    p_active_technicians,
    (bp.price_per_tech * p_active_technicians)::NUMERIC(10, 2) as monthly_cost,
    CASE
      WHEN bp.slug = 'free-trial' THEN '3-month trial, max 10 users, 90-day photo retention'
      WHEN bp.slug = 'growth' THEN 'Advanced reports, 90-day photo retention, team permissions, max 150 users'
      WHEN bp.slug = 'premium' THEN 'Everything unlimited, API access, custom fields'
      ELSE ''
    END as includes
  FROM caicos_company_subscriptions ccs
  LEFT JOIN caicos_billing_plans bp ON ccs.plan_id = bp.id
  WHERE ccs.company_id = p_company_id
    AND ccs.status = 'active';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 11. FUNCTION: Auto-delete old photos based on plan retention
-- ============================================================================

CREATE OR REPLACE FUNCTION cleanup_expired_photos()
RETURNS TABLE (deleted_count INTEGER, company_id UUID) AS $$
DECLARE
  v_company RECORD;
  v_deleted INTEGER;
BEGIN
  -- For each active company with a subscription
  FOR v_company IN
    SELECT DISTINCT c.id as cid, pf.photo_retention_days
    FROM caicos_companies c
    LEFT JOIN caicos_company_subscriptions ccs ON c.id = ccs.company_id AND ccs.status = 'active'
    LEFT JOIN caicos_plan_features pf ON ccs.plan_id = pf.plan_id
    WHERE pf.photo_retention_days > 0
      AND pf.photo_retention_days < 999999  -- Not unlimited
  LOOP
    -- Delete photos older than retention period
    DELETE FROM caicos_service_photos
    WHERE service_job_id IN (
      SELECT id FROM caicos_service_jobs
      WHERE company_id = v_company.cid
        AND created_at < NOW() - (v_company.photo_retention_days || ' days')::INTERVAL
    );

    GET DIAGNOSTICS v_deleted = ROW_COUNT;

    RETURN QUERY SELECT v_deleted, v_company.cid;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Schedule this to run daily at 2 AM UTC:
-- SELECT cron.schedule('cleanup_expired_photos', '0 2 * * *', 'SELECT cleanup_expired_photos()');

-- ============================================================================
-- 12. ROW-LEVEL SECURITY: Enforce plan limits on service_photos
-- ============================================================================

-- Add check constraint to service_photos table if it doesn't exist
-- ALTER TABLE caicos_service_photos ADD CONSTRAINT check_photo_limit
-- CHECK (check_photo_limit_fn(company_id));

-- ============================================================================
-- 13. VIEW: Company Subscription Dashboard
-- ============================================================================

CREATE OR REPLACE VIEW caicos_subscription_dashboard AS
SELECT
  c.id as company_id,
  c.name as company_name,
  bp.name as plan_name,
  bp.slug as plan_slug,
  ccs.status as subscription_status,
  pf.max_total_users,
  pf.max_photos_per_service,
  pf.photo_retention_days,
  pf.has_advanced_reports,
  pf.has_api_access,
  COUNT(DISTINCT u.id) as current_users,
  COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'technician') as current_technicians,
  (bp.price_per_tech * COUNT(DISTINCT u.id) FILTER (WHERE u.role = 'technician'))::NUMERIC(10, 2) as estimated_monthly_cost,
  ccs.trial_ends_at,
  ccs.started_at,
  CASE
    WHEN ccs.status = 'active' AND ccs.trial_ends_at > NOW() THEN 'In Trial'
    WHEN ccs.status = 'active' THEN 'Active'
    WHEN ccs.status = 'past_due' THEN 'Past Due'
    WHEN ccs.status = 'canceled' THEN 'Canceled'
    ELSE 'Unknown'
  END as subscription_phase,
  FLOOR((EXTRACT(DAY FROM (ccs.trial_ends_at - NOW())))::NUMERIC) as trial_days_remaining
FROM caicos_companies c
LEFT JOIN caicos_company_subscriptions ccs ON c.id = ccs.company_id
LEFT JOIN caicos_billing_plans bp ON ccs.plan_id = bp.id
LEFT JOIN caicos_plan_features pf ON bp.id = pf.plan_id
LEFT JOIN caicos_users u ON c.id = u.company_id
GROUP BY
  c.id, c.name, bp.name, bp.slug, bp.price_per_tech,
  ccs.status, ccs.trial_ends_at, ccs.started_at,
  pf.max_total_users, pf.max_photos_per_service, pf.photo_retention_days,
  pf.has_advanced_reports, pf.has_api_access;

-- ============================================================================
-- NOTES FOR IMPLEMENTATION
-- ============================================================================
/*

MIGRATION PATH:
1. Create tables in order: billing_plans → plan_features → company_subscriptions → usage_tracking
2. Insert default plans and features (scripts above)
3. Create functions for limit checking
4. Create RLS policies to enforce limits (see separate RLS file)
5. Migrate existing companies to free-trial or growth plan
6. Update app to check limits before creating jobs/uploading photos

ENFORCEMENT POINTS IN APPLICATION:

Before creating service job:
  SELECT * FROM check_monthly_job_limit(p_company_id)

Before uploading photo:
  SELECT * FROM check_photo_limit(p_company_id, p_service_job_id, 1)

Before adding technician:
  SELECT * FROM check_technician_limit(p_company_id)

MONTHLY CLEANUP:
  - Schedule cleanup_expired_photos() daily at 2 AM UTC
  - Add entry to pg_cron jobs table

BILLING CALCULATION:
  SELECT * FROM calculate_subscription_cost(p_company_id, 35) -- for 35 techs

DASHBOARD:
  SELECT * FROM caicos_subscription_dashboard WHERE company_id = 'xxx'

PILOT CUSTOMER SETUP:
  1. Insert company into caicos_companies
  2. Create subscription with plan_id = (SELECT id FROM caicos_billing_plans WHERE slug = 'free-trial')
  3. Set trial_ends_at = NOW() + INTERVAL '90 days'
  4. Set active_technicians = 35
  5. Calculate cost: 0 * 35 = $0 for trial (they pay when they move to Growth plan)

*/
