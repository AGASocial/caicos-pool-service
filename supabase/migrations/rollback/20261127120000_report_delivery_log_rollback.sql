-- Rollback for 20261127120000_report_delivery_log.sql (KAN-152)
-- Removes only the columns/indexes/constraints added by KAN-152. KAN-151 columns are untouched.

DROP INDEX IF EXISTS public.idx_customer_report_deliveries_property;
DROP INDEX IF EXISTS public.idx_customer_report_deliveries_company_status_created;

ALTER TABLE public.customer_report_deliveries
  DROP CONSTRAINT IF EXISTS customer_report_deliveries_attempt_count_positive;
ALTER TABLE public.customer_report_deliveries
  DROP CONSTRAINT IF EXISTS customer_report_deliveries_trigger_source_allowed;

ALTER TABLE public.customer_report_deliveries DROP COLUMN IF EXISTS updated_at;
ALTER TABLE public.customer_report_deliveries DROP COLUMN IF EXISTS attempt_count;
ALTER TABLE public.customer_report_deliveries DROP COLUMN IF EXISTS triggered_by;
ALTER TABLE public.customer_report_deliveries DROP COLUMN IF EXISTS trigger_source;
ALTER TABLE public.customer_report_deliveries DROP COLUMN IF EXISTS property_id;
