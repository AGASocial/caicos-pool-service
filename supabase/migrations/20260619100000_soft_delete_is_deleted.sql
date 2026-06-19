-- Soft delete for entities that previously used hard DELETE.
-- Adds is_deleted (default false), cascade triggers, partial unique indexes,
-- RLS filters, and blocks hard DELETE.

-- ---------------------------------------------------------------------------
-- Columns
-- ---------------------------------------------------------------------------

ALTER TABLE public.cadenza_routes
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.cadenza_route_stops
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.cadenza_route_stop_schedules
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.cadenza_service_jobs
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.cadenza_service_reports
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.cadenza_report_photos
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- ---------------------------------------------------------------------------
-- Partial unique indexes (allow re-create after soft delete)
-- ---------------------------------------------------------------------------

ALTER TABLE public.cadenza_route_stops
  DROP CONSTRAINT IF EXISTS cadenza_route_stops_property_id_unique;

CREATE UNIQUE INDEX IF NOT EXISTS cadenza_route_stops_property_id_active_unique
  ON public.cadenza_route_stops (property_id)
  WHERE NOT is_deleted;

DROP INDEX IF EXISTS public.cadenza_service_jobs_route_property_date_unique;

CREATE UNIQUE INDEX cadenza_service_jobs_route_property_date_unique
  ON public.cadenza_service_jobs (route_id, property_id, scheduled_date)
  WHERE job_source = 'route'
    AND route_id IS NOT NULL
    AND NOT is_deleted;

ALTER TABLE public.cadenza_route_stop_schedules
  DROP CONSTRAINT IF EXISTS cadenza_route_stop_schedules_stop_from_unique;

CREATE UNIQUE INDEX cadenza_route_stop_schedules_stop_from_active_unique
  ON public.cadenza_route_stop_schedules (route_stop_id, effective_from)
  WHERE NOT is_deleted;

-- ---------------------------------------------------------------------------
-- Cascade soft-delete triggers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cadenza_cascade_soft_delete_route()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted IS TRUE AND COALESCE(OLD.is_deleted, FALSE) IS NOT TRUE THEN
    UPDATE public.cadenza_route_stops
    SET is_deleted = TRUE
    WHERE route_id = NEW.id
      AND NOT is_deleted;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cadenza_cascade_soft_delete_route_stop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted IS TRUE AND COALESCE(OLD.is_deleted, FALSE) IS NOT TRUE THEN
    UPDATE public.cadenza_route_stop_schedules
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE route_stop_id = NEW.id
      AND NOT is_deleted;

    UPDATE public.cadenza_service_jobs
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE route_id = NEW.route_id
      AND property_id = NEW.property_id
      AND job_source = 'route'
      AND status = 'pending'
      AND NOT is_deleted;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cadenza_cascade_soft_delete_service_job()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted IS TRUE AND COALESCE(OLD.is_deleted, FALSE) IS NOT TRUE THEN
    UPDATE public.cadenza_service_reports
    SET is_deleted = TRUE,
        updated_at = NOW()
    WHERE job_id = NEW.id
      AND NOT is_deleted;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.cadenza_cascade_soft_delete_service_report()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_deleted IS TRUE AND COALESCE(OLD.is_deleted, FALSE) IS NOT TRUE THEN
    UPDATE public.cadenza_report_photos
    SET is_deleted = TRUE
    WHERE report_id = NEW.id
      AND NOT is_deleted;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cadenza_cascade_soft_delete_route ON public.cadenza_routes;
CREATE TRIGGER cadenza_cascade_soft_delete_route
  AFTER UPDATE OF is_deleted ON public.cadenza_routes
  FOR EACH ROW
  EXECUTE FUNCTION public.cadenza_cascade_soft_delete_route();

DROP TRIGGER IF EXISTS cadenza_cascade_soft_delete_route_stop ON public.cadenza_route_stops;
CREATE TRIGGER cadenza_cascade_soft_delete_route_stop
  AFTER UPDATE OF is_deleted ON public.cadenza_route_stops
  FOR EACH ROW
  EXECUTE FUNCTION public.cadenza_cascade_soft_delete_route_stop();

DROP TRIGGER IF EXISTS cadenza_cascade_soft_delete_service_job ON public.cadenza_service_jobs;
CREATE TRIGGER cadenza_cascade_soft_delete_service_job
  AFTER UPDATE OF is_deleted ON public.cadenza_service_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.cadenza_cascade_soft_delete_service_job();

DROP TRIGGER IF EXISTS cadenza_cascade_soft_delete_service_report ON public.cadenza_service_reports;
CREATE TRIGGER cadenza_cascade_soft_delete_service_report
  AFTER UPDATE OF is_deleted ON public.cadenza_service_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.cadenza_cascade_soft_delete_service_report();

-- ---------------------------------------------------------------------------
-- Block hard DELETE (safety net)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.cadenza_prevent_hard_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Hard delete is not allowed on %. Use is_deleted = true instead.', TG_TABLE_NAME;
END;
$$;

DROP TRIGGER IF EXISTS cadenza_prevent_hard_delete ON public.cadenza_routes;
CREATE TRIGGER cadenza_prevent_hard_delete
  BEFORE DELETE ON public.cadenza_routes
  FOR EACH ROW EXECUTE FUNCTION public.cadenza_prevent_hard_delete();

DROP TRIGGER IF EXISTS cadenza_prevent_hard_delete ON public.cadenza_route_stops;
CREATE TRIGGER cadenza_prevent_hard_delete
  BEFORE DELETE ON public.cadenza_route_stops
  FOR EACH ROW EXECUTE FUNCTION public.cadenza_prevent_hard_delete();

DROP TRIGGER IF EXISTS cadenza_prevent_hard_delete ON public.cadenza_route_stop_schedules;
CREATE TRIGGER cadenza_prevent_hard_delete
  BEFORE DELETE ON public.cadenza_route_stop_schedules
  FOR EACH ROW EXECUTE FUNCTION public.cadenza_prevent_hard_delete();

DROP TRIGGER IF EXISTS cadenza_prevent_hard_delete ON public.cadenza_service_jobs;
CREATE TRIGGER cadenza_prevent_hard_delete
  BEFORE DELETE ON public.cadenza_service_jobs
  FOR EACH ROW EXECUTE FUNCTION public.cadenza_prevent_hard_delete();

DROP TRIGGER IF EXISTS cadenza_prevent_hard_delete ON public.cadenza_service_reports;
CREATE TRIGGER cadenza_prevent_hard_delete
  BEFORE DELETE ON public.cadenza_service_reports
  FOR EACH ROW EXECUTE FUNCTION public.cadenza_prevent_hard_delete();

DROP TRIGGER IF EXISTS cadenza_prevent_hard_delete ON public.cadenza_report_photos;
CREATE TRIGGER cadenza_prevent_hard_delete
  BEFORE DELETE ON public.cadenza_report_photos
  FOR EACH ROW EXECUTE FUNCTION public.cadenza_prevent_hard_delete();

-- ---------------------------------------------------------------------------
-- RLS: hide soft-deleted rows from SELECT; allow UPDATE for soft delete
-- ---------------------------------------------------------------------------

DROP POLICY IF EXISTS "Users can view company routes" ON public.cadenza_routes;
CREATE POLICY "Users can view company routes"
  ON public.cadenza_routes FOR SELECT
  USING (company_id = get_my_company_id() AND NOT is_deleted);

DROP POLICY IF EXISTS "Admins can manage routes" ON public.cadenza_routes;
CREATE POLICY "Admins can manage routes"
  ON public.cadenza_routes FOR ALL
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'operations')
    AND NOT is_deleted
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'operations')
  );

DROP POLICY IF EXISTS "Users can view company route stops" ON public.cadenza_route_stops;
CREATE POLICY "Users can view company route stops"
  ON public.cadenza_route_stops FOR SELECT
  USING (
    NOT is_deleted
    AND EXISTS (
      SELECT 1
      FROM public.cadenza_routes r
      WHERE r.id = route_id
        AND r.company_id = get_my_company_id()
        AND NOT r.is_deleted
    )
  );

DROP POLICY IF EXISTS "Admins can manage route stops" ON public.cadenza_route_stops;
CREATE POLICY "Admins can manage route stops"
  ON public.cadenza_route_stops FOR ALL
  USING (
    NOT is_deleted
    AND EXISTS (
      SELECT 1
      FROM public.cadenza_routes r
      WHERE r.id = route_id
        AND r.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'admin', 'operations')
        AND NOT r.is_deleted
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.cadenza_routes r
      WHERE r.id = route_id
        AND r.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'admin', 'operations')
        AND NOT r.is_deleted
    )
  );

DROP POLICY IF EXISTS "Users can view company route stop schedules" ON public.cadenza_route_stop_schedules;
CREATE POLICY "Users can view company route stop schedules"
  ON public.cadenza_route_stop_schedules FOR SELECT
  USING (
    NOT is_deleted
    AND EXISTS (
      SELECT 1
      FROM public.cadenza_route_stops s
      JOIN public.cadenza_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id
        AND r.company_id = get_my_company_id()
        AND NOT s.is_deleted
        AND NOT r.is_deleted
    )
  );

DROP POLICY IF EXISTS "Admins can manage route stop schedules" ON public.cadenza_route_stop_schedules;
CREATE POLICY "Admins can manage route stop schedules"
  ON public.cadenza_route_stop_schedules FOR ALL
  USING (
    NOT is_deleted
    AND EXISTS (
      SELECT 1
      FROM public.cadenza_route_stops s
      JOIN public.cadenza_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id
        AND r.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'admin', 'operations')
        AND NOT s.is_deleted
        AND NOT r.is_deleted
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.cadenza_route_stops s
      JOIN public.cadenza_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id
        AND r.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'admin', 'operations')
        AND NOT s.is_deleted
        AND NOT r.is_deleted
    )
  );

DROP POLICY IF EXISTS "Users can view company jobs" ON public.cadenza_service_jobs;
CREATE POLICY "Users can view company jobs"
  ON public.cadenza_service_jobs FOR SELECT
  USING (company_id = get_my_company_id() AND NOT is_deleted);

DROP POLICY IF EXISTS "Admins can update jobs" ON public.cadenza_service_jobs;
CREATE POLICY "Admins can update jobs"
  ON public.cadenza_service_jobs FOR UPDATE
  USING (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'operations')
    AND NOT is_deleted
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'operations')
  );

DROP POLICY IF EXISTS "Techs can update their assigned jobs" ON public.cadenza_service_jobs;
CREATE POLICY "Techs can update their assigned jobs"
  ON public.cadenza_service_jobs FOR UPDATE
  USING (
    company_id = get_my_company_id()
    AND technician_id = auth.uid()
    AND NOT is_deleted
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND technician_id = auth.uid()
    AND NOT is_deleted
  );

DROP POLICY IF EXISTS "Users can view company reports" ON public.cadenza_service_reports;
CREATE POLICY "Users can view company reports"
  ON public.cadenza_service_reports FOR SELECT
  USING (company_id = get_my_company_id() AND NOT is_deleted);

DROP POLICY IF EXISTS "Techs can update own reports" ON public.cadenza_service_reports;
CREATE POLICY "Techs can update own reports"
  ON public.cadenza_service_reports FOR UPDATE
  USING (
    company_id = get_my_company_id()
    AND technician_id = auth.uid()
    AND NOT is_deleted
  )
  WITH CHECK (
    company_id = get_my_company_id()
    AND technician_id = auth.uid()
    AND NOT is_deleted
  );

DROP POLICY IF EXISTS "Users can view company photos" ON public.cadenza_report_photos;
CREATE POLICY "Users can view company photos"
  ON public.cadenza_report_photos FOR SELECT
  USING (company_id = get_my_company_id() AND NOT is_deleted);

DROP POLICY IF EXISTS "Company users can delete report photos" ON public.cadenza_report_photos;
CREATE POLICY "Company users can soft delete report photos"
  ON public.cadenza_report_photos FOR UPDATE
  USING (company_id = get_my_company_id() AND NOT is_deleted)
  WITH CHECK (company_id = get_my_company_id());

-- ---------------------------------------------------------------------------
-- Stats RPCs: exclude soft-deleted jobs
-- ---------------------------------------------------------------------------

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
    AND NOT is_deleted
  GROUP BY scheduled_date
  ON CONFLICT (company_id, stat_date) DO UPDATE SET
    pending_count = EXCLUDED.pending_count,
    in_progress_count = EXCLUDED.in_progress_count,
    completed_count = EXCLUDED.completed_count,
    skipped_count = EXCLUDED.skipped_count,
    cancelled_count = EXCLUDED.cancelled_count,
    total_count = EXCLUDED.total_count;
$$;

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
    (SELECT COUNT(*) FROM public.cadenza_service_jobs WHERE company_id = p_company_id AND NOT is_deleted),
    (SELECT COUNT(*) FROM public.cadenza_routes WHERE company_id = p_company_id AND NOT is_deleted),
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
      AND NOT j.is_deleted
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
