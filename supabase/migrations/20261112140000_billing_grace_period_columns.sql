-- ALREADY APPLIED in the shared DB — record-only; do not re-apply manually.
-- KAN-148: 14-day payment-failure grace (full access; never extend on later failures).

ALTER TABLE public.cadenza_billing_subscriptions
  ADD COLUMN IF NOT EXISTS payment_failed_at TIMESTAMPTZ NULL;

ALTER TABLE public.cadenza_billing_subscriptions
  ADD COLUMN IF NOT EXISTS grace_period_ends_at TIMESTAMPTZ NULL;

COMMENT ON COLUMN public.cadenza_billing_subscriptions.payment_failed_at IS
  'Set on first invoice.payment_failed; not overwritten by later failures.';

COMMENT ON COLUMN public.cadenza_billing_subscriptions.grace_period_ends_at IS
  'End of 14-day full-access grace after first payment failure; never extended.';
