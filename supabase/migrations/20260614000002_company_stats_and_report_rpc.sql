-- US-D-002: Company stats counters
-- US-B-004: SQL aggregation for job reports
-- US-D-006: Daily job stats rollup

CREATE TABLE IF NOT EXISTS public.cadenza_company_stats (
  company_id UUID PRIMARY KEY REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  total_jobs BIGINT NOT NULL DEFAULT 0,
  total_routes BIGINT NOT NULL DEFAULT 0,
  total_team_members BIGINT NOT NULL DEFAULT 0,
  total_properties BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.cadenza_company_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY cadenza_company_stats_select ON public.cadenza_company_stats
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM public.cadenza_profiles WHERE id = auth.uid()
  ));

-- Backfill stats for existing companies
INSERT INTO public.cadenza_company_stats (company_id, total_jobs, total_routes, total_team_members, total_properties)
SELECT c.id,
  (SELECT COUNT(*) FROM public.cadenza_service_jobs j WHERE j.company_id = c.id),
  (SELECT COUNT(*) FROM public.cadenza_routes r WHERE r.company_id = c.id),
  (SELECT COUNT(*) FROM public.cadenza_profiles p WHERE p.company_id = c.id),
  (SELECT COUNT(*) FROM public.cadenza_properties pr WHERE pr.company_id = c.id)
FROM public.cadenza_companies c
ON CONFLICT (company_id) DO UPDATE SET
  total_jobs = EXCLUDED.total_jobs,
  total_routes = EXCLUDED.total_routes,
  total_team_members = EXCLUDED.total_team_members,
  total_properties = EXCLUDED.total_properties,
  updated_at = now();

CREATE OR REPLACE FUNCTION public.refresh_company_stats(p_company_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cadenza_company_stats (company_id, total_jobs, total_routes, total_team_members, total_properties, updated_at)
  VALUES (
    p_company_id,
    (SELECT COUNT(*) FROM public.cadenza_service_jobs WHERE company_id = p_company_id),
    (SELECT COUNT(*) FROM public.cadenza_routes WHERE company_id = p_company_id),
    (SELECT COUNT(*) FROM public.cadenza_profiles WHERE company_id = p_company_id),
    (SELECT COUNT(*) FROM public.cadenza_properties WHERE company_id = p_company_id),
    now()
  )
  ON CONFLICT (company_id) DO UPDATE SET
    total_jobs = EXCLUDED.total_jobs,
    total_routes = EXCLUDED.total_routes,
    total_team_members = EXCLUDED.total_team_members,
    total_properties = EXCLUDED.total_properties,
    updated_at = now();
END;
$$;

-- Job report aggregation RPC (US-B-004)
CREATE OR REPLACE FUNCTION public.get_job_report_stats(
  p_company_id UUID,
  p_date_from DATE DEFAULT NULL,
  p_date_to DATE DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH filtered AS (
    SELECT j.status, j.technician_id, p.full_name AS tech_name
    FROM public.cadenza_service_jobs j
    LEFT JOIN public.cadenza_profiles p ON p.id = j.technician_id
    WHERE j.company_id = p_company_id
      AND (p_date_from IS NULL OR j.scheduled_date >= p_date_from)
      AND (p_date_to IS NULL OR j.scheduled_date <= p_date_to)
  ),
  status_counts AS (
    SELECT
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
      COUNT(*) FILTER (WHERE status = 'in_progress')::int AS in_progress,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
      COUNT(*) FILTER (WHERE status = 'skipped')::int AS skipped,
      COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled
    FROM filtered
  ),
  tech_counts AS (
    SELECT
      technician_id,
      COALESCE(tech_name, 'Unknown') AS full_name,
      COUNT(*)::int AS total,
      COUNT(*) FILTER (WHERE status = 'completed')::int AS completed
    FROM filtered
    WHERE technician_id IS NOT NULL
    GROUP BY technician_id, tech_name
  )
  SELECT jsonb_build_object(
    'total', sc.total,
    'byStatus', jsonb_build_object(
      'pending', sc.pending,
      'in_progress', sc.in_progress,
      'completed', sc.completed,
      'skipped', sc.skipped,
      'cancelled', sc.cancelled
    ),
    'completionRate', CASE WHEN sc.total > 0 THEN ROUND(sc.completed::numeric / sc.total, 3) ELSE 0 END,
    'byTechnician', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'technicianId', technician_id,
        'fullName', full_name,
        'total', total,
        'completed', completed
      ) ORDER BY full_name)
      FROM tech_counts
    ), '[]'::jsonb)
  )
  FROM status_counts sc;
$$;

-- Daily rollup table (US-D-006)
CREATE TABLE IF NOT EXISTS public.cadenza_job_stats_daily (
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  stat_date DATE NOT NULL,
  pending_count INT NOT NULL DEFAULT 0,
  in_progress_count INT NOT NULL DEFAULT 0,
  completed_count INT NOT NULL DEFAULT 0,
  skipped_count INT NOT NULL DEFAULT 0,
  cancelled_count INT NOT NULL DEFAULT 0,
  total_count INT NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_job_stats_daily_company_date
  ON public.cadenza_job_stats_daily (company_id, stat_date DESC);

ALTER TABLE public.cadenza_job_stats_daily ENABLE ROW LEVEL SECURITY;

CREATE POLICY cadenza_job_stats_daily_select ON public.cadenza_job_stats_daily
  FOR SELECT USING (company_id IN (
    SELECT company_id FROM public.cadenza_profiles WHERE id = auth.uid()
  ));

CREATE OR REPLACE FUNCTION public.refresh_job_stats_daily(p_company_id UUID, p_from DATE, p_to DATE)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.cadenza_job_stats_daily (
    company_id, stat_date, pending_count, in_progress_count, completed_count,
    skipped_count, cancelled_count, total_count
  )
  SELECT
    p_company_id,
    scheduled_date,
    COUNT(*) FILTER (WHERE status = 'pending'),
    COUNT(*) FILTER (WHERE status = 'in_progress'),
    COUNT(*) FILTER (WHERE status = 'completed'),
    COUNT(*) FILTER (WHERE status = 'skipped'),
    COUNT(*) FILTER (WHERE status = 'cancelled'),
    COUNT(*)
  FROM public.cadenza_service_jobs
  WHERE company_id = p_company_id
    AND scheduled_date BETWEEN p_from AND p_to
  GROUP BY scheduled_date
  ON CONFLICT (company_id, stat_date) DO UPDATE SET
    pending_count = EXCLUDED.pending_count,
    in_progress_count = EXCLUDED.in_progress_count,
    completed_count = EXCLUDED.completed_count,
    skipped_count = EXCLUDED.skipped_count,
    cancelled_count = EXCLUDED.cancelled_count,
    total_count = EXCLUDED.total_count;
$$;
