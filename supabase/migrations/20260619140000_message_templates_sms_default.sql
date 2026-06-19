-- Default SMS follow-up template per company (matches email seed pattern).

INSERT INTO public.cadenza_message_templates (
  company_id,
  channel,
  name,
  subject,
  body,
  issue_categories,
  is_default
)
SELECT
  c.id,
  'sms',
  'SMS seguimiento genérico',
  NULL,
  E'Hola {{customer_name}}, le escribimos de {{company_name}} por el servicio en {{property_address}} ({{scheduled_date}}). {{technician_name}} reportó: {{issue_details}}. ¿Alguna pregunta?',
  '{}'::TEXT[],
  TRUE
FROM public.cadenza_companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cadenza_message_templates t
  WHERE t.company_id = c.id
    AND t.channel = 'sms'
    AND t.is_default IS TRUE
);
