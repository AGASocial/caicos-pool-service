-- Template locale (en now; es reserved for future). English default copy.

ALTER TABLE public.cadenza_message_templates
  ADD COLUMN IF NOT EXISTS locale TEXT NOT NULL DEFAULT 'en';

ALTER TABLE public.cadenza_message_templates
  DROP CONSTRAINT IF EXISTS message_templates_locale_allowed;

ALTER TABLE public.cadenza_message_templates
  ADD CONSTRAINT message_templates_locale_allowed CHECK (locale IN ('en', 'es'));

COMMENT ON COLUMN public.cadenza_message_templates.locale IS
  'Template language. Only en is used today; es reserved for future per-locale templates.';

DROP INDEX IF EXISTS public.cadenza_message_templates_one_default_per_channel;

CREATE UNIQUE INDEX cadenza_message_templates_one_default_per_channel_locale
  ON public.cadenza_message_templates (company_id, channel, locale)
  WHERE is_default IS TRUE;

UPDATE public.cadenza_message_templates
SET
  locale = 'en',
  name = 'Generic follow-up',
  subject = 'Service follow-up — {{property_address}}',
  body = E'Dear {{customer_name}},

Regarding the service visit at {{property_address}} on {{scheduled_date}}.

The following was noted during the visit:

{{issue_details}}

Please let us know if you have any questions or if you would like to schedule a follow-up visit.

Best regards,
{{company_name}}',
  updated_at = NOW()
WHERE channel = 'email'
  AND is_default IS TRUE;

UPDATE public.cadenza_message_templates
SET
  locale = 'en',
  name = 'Generic SMS follow-up',
  body = E'Hi {{customer_name}}, {{company_name}} here about service at {{property_address}} ({{scheduled_date}}). Noted: {{issue_details}}. Any questions?',
  updated_at = NOW()
WHERE channel = 'sms'
  AND is_default IS TRUE;

-- Non-default rows: mark locale for future i18n (content unchanged).
UPDATE public.cadenza_message_templates
SET locale = 'en', updated_at = NOW()
WHERE locale IS DISTINCT FROM 'en' OR locale IS NULL;
