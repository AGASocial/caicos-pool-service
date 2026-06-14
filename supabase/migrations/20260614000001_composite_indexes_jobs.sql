-- US-D-001: Composite indexes for admin query patterns

CREATE INDEX IF NOT EXISTS idx_jobs_company_date
  ON public.cadenza_service_jobs (company_id, scheduled_date DESC);

CREATE INDEX IF NOT EXISTS idx_jobs_company_status_date
  ON public.cadenza_service_jobs (company_id, status, scheduled_date);
