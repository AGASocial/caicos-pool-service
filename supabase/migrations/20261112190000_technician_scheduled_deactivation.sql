-- Pending technician deactivation: keep access until subscription period end,
-- then deactivate and (quantity already lowered with proration_behavior=none).
-- DO NOT apply automatically — owner must run this migration.

ALTER TABLE public.cadenza_profiles
  ADD COLUMN IF NOT EXISTS scheduled_deactivation_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.cadenza_profiles.scheduled_deactivation_at IS
  'When set, technician remains is_active until this timestamp (usually subscription current_period_end), then a cron/webhook sets is_active=false.';

CREATE INDEX IF NOT EXISTS idx_cadenza_profiles_scheduled_deactivation
  ON public.cadenza_profiles (scheduled_deactivation_at)
  WHERE scheduled_deactivation_at IS NOT NULL;
