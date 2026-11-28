-- KAN-154: Monday digest of open issues - send log (idempotency + "last sent" cue)
-- Additive only. Idempotent. No backfill, therefore no backup table.
-- Do not run against shared prod/develop from agent tooling - apply via your normal migration process.
--
-- ROLLBACK: supabase/migrations/rollback/20261127200000_monday_open_issues_digest_rollback.sql

CREATE TABLE IF NOT EXISTS public.cadenza_monday_digest_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  -- Monday of the America/New_York week the digest covers.
  week_start DATE NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resend_message_id TEXT,
  issue_count INTEGER NOT NULL CHECK (issue_count >= 0),
  CONSTRAINT cadenza_monday_digest_sends_unique_recipient_week
    UNIQUE (company_id, week_start, recipient_email)
);

COMMENT ON TABLE public.cadenza_monday_digest_sends IS
  'KAN-154: one row per Monday open-issues digest email sent (company + week + recipient). Written by the service role only.';

CREATE INDEX IF NOT EXISTS idx_cadenza_monday_digest_sends_company_sent
  ON public.cadenza_monday_digest_sends (company_id, sent_at DESC);

ALTER TABLE public.cadenza_monday_digest_sends ENABLE ROW LEVEL SECURITY;

-- Office roles of the same company may read the log. There is deliberately no INSERT / UPDATE /
-- DELETE policy: only the service role (which bypasses RLS) writes to this table.
DROP POLICY IF EXISTS "Office staff can view monday digest sends"
  ON public.cadenza_monday_digest_sends;
CREATE POLICY "Office staff can view monday digest sends"
  ON public.cadenza_monday_digest_sends FOR SELECT
  TO authenticated
  USING (
    cadenza_monday_digest_sends.company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  );

REVOKE ALL ON TABLE public.cadenza_monday_digest_sends FROM PUBLIC;
REVOKE ALL ON TABLE public.cadenza_monday_digest_sends FROM anon;
REVOKE ALL ON TABLE public.cadenza_monday_digest_sends FROM authenticated;
GRANT SELECT ON TABLE public.cadenza_monday_digest_sends TO authenticated;
GRANT ALL ON TABLE public.cadenza_monday_digest_sends TO service_role;
