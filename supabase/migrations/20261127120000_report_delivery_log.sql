-- KAN-152: Customer report delivery log (actor, property, attempts)
-- Additive only. Idempotent. Do not run against shared prod/develop from agent tooling —
-- apply via your normal migration process.
--
-- Builds on KAN-151 public.customer_report_deliveries. The existing status CHECK
-- (queued/sent/failed/skipped), reason (error details) and RLS policies are reused unchanged.
-- "queued" is surfaced in the UI as "pending".

ALTER TABLE public.customer_report_deliveries
  ADD COLUMN IF NOT EXISTS property_id UUID
    REFERENCES public.cadenza_properties(id) ON DELETE SET NULL;

ALTER TABLE public.customer_report_deliveries
  ADD COLUMN IF NOT EXISTS trigger_source TEXT NOT NULL DEFAULT 'auto';

ALTER TABLE public.customer_report_deliveries
  ADD COLUMN IF NOT EXISTS triggered_by UUID
    REFERENCES public.cadenza_profiles(id) ON DELETE SET NULL;

ALTER TABLE public.customer_report_deliveries
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 1;

-- updated_at = time of the latest attempt. Added nullable, backfilled from created_at,
-- then defaulted/required so re-running this migration never rewrites real values.
ALTER TABLE public.customer_report_deliveries
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

UPDATE public.customer_report_deliveries
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.customer_report_deliveries
  ALTER COLUMN updated_at SET DEFAULT NOW();

ALTER TABLE public.customer_report_deliveries
  ALTER COLUMN updated_at SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_report_deliveries_trigger_source_allowed'
  ) THEN
    ALTER TABLE public.customer_report_deliveries
      ADD CONSTRAINT customer_report_deliveries_trigger_source_allowed
      CHECK (trigger_source IN ('auto', 'manual', 'retry'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_report_deliveries_attempt_count_positive'
  ) THEN
    ALTER TABLE public.customer_report_deliveries
      ADD CONSTRAINT customer_report_deliveries_attempt_count_positive
      CHECK (attempt_count >= 1);
  END IF;
END $$;

-- Backfill property reference from the job for rows written by KAN-151.
UPDATE public.customer_report_deliveries d
SET property_id = j.property_id
FROM public.cadenza_service_jobs j
WHERE d.job_id = j.id
  AND d.property_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_customer_report_deliveries_company_status_created
  ON public.customer_report_deliveries (company_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_report_deliveries_property
  ON public.customer_report_deliveries (property_id, created_at DESC)
  WHERE property_id IS NOT NULL;

COMMENT ON COLUMN public.customer_report_deliveries.property_id IS
  'Property the report belongs to (denormalized from the job for log filtering).';
COMMENT ON COLUMN public.customer_report_deliveries.trigger_source IS
  'auto = system/cron/job-complete hook; manual or retry = a user acted from the portal.';
COMMENT ON COLUMN public.customer_report_deliveries.triggered_by IS
  'User who triggered the latest attempt; NULL for automatic sends.';
COMMENT ON COLUMN public.customer_report_deliveries.attempt_count IS
  'Number of send attempts recorded on this row (the row is updated in place on retry).';
COMMENT ON COLUMN public.customer_report_deliveries.updated_at IS
  'Time of the latest attempt / status change.';
