-- Fix soft-delete RLS: UPDATE WITH CHECK must allow is_deleted = true on the new row.
-- Cascade trigger functions run as SECURITY DEFINER so child rows can be marked deleted.

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
