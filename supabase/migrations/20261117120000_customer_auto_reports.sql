-- KAN-151: Automatic customer service reports
-- Additive only. Idempotent. Do not run against shared prod/develop from agent tooling —
-- apply via your normal migration process.

-- ---------------------------------------------------------------------------
-- Per-company which routine event types auto-email the customer
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cadenza_customer_report_settings (
  company_id UUID PRIMARY KEY REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  auto_send_event_types TEXT[] NOT NULL DEFAULT ARRAY[
    'filter_change',
    'o_ring_replacement',
    'filter_cleaning',
    'low_water_level'
  ]::TEXT[],
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cadenza_customer_report_settings_auto_send_allowed CHECK (
    auto_send_event_types <@ ARRAY[
      'filter_change',
      'o_ring_replacement',
      'filter_cleaning',
      'low_water_level'
    ]::TEXT[]
  )
);

COMMENT ON TABLE public.cadenza_customer_report_settings IS
  'Company config for which routine visit event types trigger an automatic customer report email.';

ALTER TABLE public.cadenza_customer_report_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can view customer report settings"
  ON public.cadenza_customer_report_settings;
CREATE POLICY "Company users can view customer report settings"
  ON public.cadenza_customer_report_settings FOR SELECT
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Office staff can manage customer report settings"
  ON public.cadenza_customer_report_settings;
CREATE POLICY "Office staff can manage customer report settings"
  ON public.cadenza_customer_report_settings FOR ALL
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  );

INSERT INTO public.cadenza_customer_report_settings (company_id)
SELECT c.id FROM public.cadenza_companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.cadenza_customer_report_settings s WHERE s.company_id = c.id
);

CREATE OR REPLACE FUNCTION public.seed_customer_report_settings_for_company(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cadenza_customer_report_settings (company_id)
  VALUES (p_company_id)
  ON CONFLICT (company_id) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_seed_customer_report_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_customer_report_settings_for_company(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cadenza_companies_seed_customer_report_settings
  ON public.cadenza_companies;
CREATE TRIGGER trg_cadenza_companies_seed_customer_report_settings
  AFTER INSERT ON public.cadenza_companies
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_seed_customer_report_settings();

-- ---------------------------------------------------------------------------
-- Job: paid extras + per-job "send report to customer" toggle
-- ---------------------------------------------------------------------------
ALTER TABLE public.cadenza_service_jobs
  ADD COLUMN IF NOT EXISTS has_paid_extras BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.cadenza_service_jobs
  ADD COLUMN IF NOT EXISTS send_paid_extra_report BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.cadenza_service_jobs.has_paid_extras IS
  'True when this visit included billable add-on work.';
COMMENT ON COLUMN public.cadenza_service_jobs.send_paid_extra_report IS
  'When has_paid_extras is true, whether to email the customer a report on job close.';

-- ---------------------------------------------------------------------------
-- Report: routine service event types recorded on the visit
-- (chemical/salt readings stay on existing columns and are never emailed)
-- ---------------------------------------------------------------------------
ALTER TABLE public.cadenza_service_reports
  ADD COLUMN IF NOT EXISTS service_event_types TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cadenza_service_reports_service_event_types_allowed'
  ) THEN
    ALTER TABLE public.cadenza_service_reports
      ADD CONSTRAINT cadenza_service_reports_service_event_types_allowed CHECK (
        service_event_types <@ ARRAY[
          'filter_change',
          'o_ring_replacement',
          'filter_cleaning',
          'low_water_level',
          'chemical_reading',
          'salt_addition'
        ]::TEXT[]
      );
  END IF;
END $$;

COMMENT ON COLUMN public.cadenza_service_reports.service_event_types IS
  'Routine (and optional chemical) event tags for the visit. Chemical tags are never emailed.';

-- ---------------------------------------------------------------------------
-- Minimal delivery log for a later delivery-log UI
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.customer_report_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.cadenza_service_jobs(id) ON DELETE CASCADE,
  recipient TEXT,
  status TEXT NOT NULL CHECK (status IN ('queued', 'sent', 'failed', 'skipped')),
  reason TEXT,
  provider_message_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_report_deliveries_company_created
  ON public.customer_report_deliveries (company_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_customer_report_deliveries_job
  ON public.customer_report_deliveries (job_id, created_at DESC);

COMMENT ON TABLE public.customer_report_deliveries IS
  'Send attempts for automatic customer visit reports (queued/sent/failed/skipped).';

ALTER TABLE public.customer_report_deliveries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Company users can view customer report deliveries"
  ON public.customer_report_deliveries;
CREATE POLICY "Company users can view customer report deliveries"
  ON public.customer_report_deliveries FOR SELECT
  USING (company_id = public.get_my_company_id());

DROP POLICY IF EXISTS "Office staff can insert customer report deliveries"
  ON public.customer_report_deliveries;
CREATE POLICY "Office staff can insert customer report deliveries"
  ON public.customer_report_deliveries FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  );
