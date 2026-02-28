-- Revert: only the assigned technician can update a job (technician_id must equal auth.uid()).
-- Unassigned jobs (technician_id IS NULL) are not shown in the tech app and cannot be updated by techs.
-- Run in Supabase SQL Editor if you previously applied 20260228000000_tech_can_update_unassigned_jobs.sql.

DROP POLICY IF EXISTS "Techs can update their assigned jobs" ON caicos_service_jobs;

CREATE POLICY "Techs can update their assigned jobs"
  ON caicos_service_jobs FOR UPDATE
  USING (company_id = get_my_company_id() AND technician_id = auth.uid());
