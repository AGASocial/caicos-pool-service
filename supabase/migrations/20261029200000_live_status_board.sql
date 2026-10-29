-- KAN-64: Live technician status board
-- Add en_route status, en_route_at timestamp, and realtime publication

-- 1. Add en_route to job status check constraint
ALTER TABLE public.cadenza_service_jobs
  DROP CONSTRAINT IF EXISTS cadenza_service_jobs_status_check;

ALTER TABLE public.cadenza_service_jobs
  ADD CONSTRAINT cadenza_service_jobs_status_check
  CHECK (status IN ('pending', 'en_route', 'in_progress', 'completed', 'skipped', 'cancelled'));

-- 2. Add en_route_at timestamp column
ALTER TABLE public.cadenza_service_jobs
  ADD COLUMN IF NOT EXISTS en_route_at timestamptz;

COMMENT ON COLUMN public.cadenza_service_jobs.en_route_at IS 'Timestamp when technician marked job as en_route (on my way)';

-- 3. Add index for status board queries (company + scheduled_date + status)
CREATE INDEX IF NOT EXISTS idx_cadenza_service_jobs_status_board
  ON public.cadenza_service_jobs(company_id, scheduled_date, status)
  WHERE NOT is_deleted;

-- 4. Add tables to supabase_realtime publication idempotently
DO $$
BEGIN
  -- Add cadenza_service_jobs if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cadenza_service_jobs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cadenza_service_jobs;
  END IF;

  -- Add cadenza_service_reports if not already in publication
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'cadenza_service_reports'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.cadenza_service_reports;
  END IF;
END $$;

-- 5. Confirm existing RLS policies cover realtime reads
-- (SELECT policies are already in place for company-scoped access)

COMMENT ON COLUMN public.cadenza_service_jobs.status IS 'Job status: pending (not started), en_route (technician on the way), in_progress (on site), completed, skipped, cancelled';
