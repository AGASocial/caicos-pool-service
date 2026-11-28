-- Rollback for 20261128030000_shared_properties_last_service.sql (KAN-155)
-- Removes only the objects added by KAN-155. There was no backfill, so no backup table exists.
-- Note: dropping the column discards every property's is_shared flag.

DROP INDEX IF EXISTS public.idx_cadenza_properties_company_shared;

ALTER TABLE public.cadenza_properties DROP COLUMN IF EXISTS is_shared;
