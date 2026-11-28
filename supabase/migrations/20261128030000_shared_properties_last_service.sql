-- KAN-155: Shared properties (same-company, multi-technician) flag.
-- Additive only. Idempotent. Do not run against the shared prod/develop database from agent
-- tooling; apply via the normal migration process.
--
-- "Shared" here means a property is visited by more than one technician of the SAME company.
-- It is NOT cross-tenant sharing: no RLS policy is added or changed, and every read of this
-- column stays behind the existing company-scoped policies on public.cadenza_properties.
--
-- No backfill (nothing is auto-flagged), therefore no backup table is created.
--
-- Rollback: migrations/rollback/20261128030000_shared_properties_last_service_rollback.sql

ALTER TABLE public.cadenza_properties
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.cadenza_properties.is_shared IS
  'KAN-155: true when the property is visited by more than one technician of the same company (shows a last-service summary on the job). Not cross-tenant sharing.';

-- Partial index: only shared properties are indexed, scoped by company.
CREATE INDEX IF NOT EXISTS idx_cadenza_properties_company_shared
  ON public.cadenza_properties (company_id)
  WHERE is_shared;
