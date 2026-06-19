-- Billing schema hardening: quantity, plan active flag, provider unique indexes, expired sub cleanup.

ALTER TABLE public.cadenza_billing_plans
  ADD COLUMN IF NOT EXISTS active boolean NOT NULL DEFAULT true;

ALTER TABLE public.cadenza_billing_subscriptions
  ADD COLUMN IF NOT EXISTS quantity integer NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS cadenza_billing_subscriptions_provider_sub_id_uidx
  ON public.cadenza_billing_subscriptions (provider_subscription_id);

CREATE UNIQUE INDEX IF NOT EXISTS cadenza_billing_invoices_provider_invoice_id_uidx
  ON public.cadenza_billing_invoices (provider_invoice_id);

-- Expired paid periods should not remain active
UPDATE public.cadenza_billing_subscriptions
SET status = 'canceled', updated_at = now()
WHERE status IN ('active', 'past_due')
  AND current_period_end IS NOT NULL
  AND current_period_end < now();
