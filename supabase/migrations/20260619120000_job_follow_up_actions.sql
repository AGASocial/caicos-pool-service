-- Office follow-up action log + resolve status for issue queue (dashboard / jobs filter).

ALTER TABLE public.cadenza_service_reports
  ADD COLUMN IF NOT EXISTS follow_up_status TEXT NOT NULL DEFAULT 'open';

ALTER TABLE public.cadenza_service_reports
  DROP CONSTRAINT IF EXISTS follow_up_status_allowed;

ALTER TABLE public.cadenza_service_reports
  ADD CONSTRAINT follow_up_status_allowed CHECK (
    follow_up_status IN ('open', 'resolved')
  );

COMMENT ON COLUMN public.cadenza_service_reports.follow_up_status IS
  'Office queue status: open = needs attention; resolved = handled and hidden from queue.';

CREATE TABLE public.cadenza_job_follow_up_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  job_id UUID NOT NULL REFERENCES public.cadenza_service_jobs(id) ON DELETE CASCADE,
  report_id UUID REFERENCES public.cadenza_service_reports(id) ON DELETE SET NULL,
  author_id UUID NOT NULL REFERENCES public.cadenza_profiles(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (
    action_type IN ('note', 'email_sent', 'resolved', 'call')
  ),
  body TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cadenza_job_follow_up_actions_job
  ON public.cadenza_job_follow_up_actions (job_id, created_at DESC);

CREATE INDEX idx_cadenza_job_follow_up_actions_company
  ON public.cadenza_job_follow_up_actions (company_id, created_at DESC);

ALTER TABLE public.cadenza_job_follow_up_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view follow-up actions"
  ON public.cadenza_job_follow_up_actions FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Office staff can insert follow-up actions"
  ON public.cadenza_job_follow_up_actions FOR INSERT
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND author_id = auth.uid()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  );

-- Allow office staff to mark reports resolved (follow_up_status only; techs keep own-report updates).
CREATE POLICY "Office can update report follow-up status"
  ON public.cadenza_service_reports FOR UPDATE
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  );
