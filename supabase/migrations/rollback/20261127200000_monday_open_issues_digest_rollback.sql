-- Rollback for 20261127200000_monday_open_issues_digest.sql (KAN-154)
-- Removes only the objects added by KAN-154. The table holds send-log rows only (no source data),
-- so dropping it loses nothing but idempotency history.

DROP POLICY IF EXISTS "Office staff can view monday digest sends"
  ON public.cadenza_monday_digest_sends;
DROP INDEX IF EXISTS public.idx_cadenza_monday_digest_sends_company_sent;
DROP TABLE IF EXISTS public.cadenza_monday_digest_sends;
