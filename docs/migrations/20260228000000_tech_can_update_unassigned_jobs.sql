-- Allow technicians to update jobs that are assigned to them OR unassigned (technician_id IS NULL).
-- Previously only technician_id = auth.uid() was allowed, so unassigned jobs could not be completed by techs.
-- Run in Supabase SQL Editor or apply via your migration flow.

DROP POLICY IF EXISTS "Techs can update their assigned jobs" ON caicos_service_jobs;

CREATE POLICY "Techs can update their assigned jobs"
  ON caicos_service_jobs FOR UPDATE
  USING (
    company_id = get_my_company_id()
    AND (technician_id = auth.uid() OR technician_id IS NULL)
  );
