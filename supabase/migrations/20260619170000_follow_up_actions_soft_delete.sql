-- Soft delete for office follow-up action log entries (undo mistaken logs).

ALTER TABLE public.cadenza_job_follow_up_actions
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

DROP POLICY IF EXISTS "Company users can view follow-up actions"
  ON public.cadenza_job_follow_up_actions;

CREATE POLICY "Company users can view follow-up actions"
  ON public.cadenza_job_follow_up_actions FOR SELECT
  USING (
    company_id = public.get_my_company_id()
    AND NOT is_deleted
  );

CREATE POLICY "Office staff can soft-delete follow-up actions"
  ON public.cadenza_job_follow_up_actions FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
    AND NOT is_deleted
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  );
