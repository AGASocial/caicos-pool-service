-- Default templates: Jun/DD/YYYY dates at render time; remove technician from copy.

UPDATE public.cadenza_message_templates
SET
  body = E'Estimado/a {{customer_name}},

Le escribimos respecto al servicio realizado en {{property_address}} el {{scheduled_date}}.

Durante la visita se reportó lo siguiente:

{{issue_details}}

Por favor indíquenos si tiene alguna pregunta o desea que programemos una visita de seguimiento.

Saludos cordiales,
{{company_name}}',
  updated_at = NOW()
WHERE channel = 'email'
  AND is_default IS TRUE
  AND body LIKE '%{{technician_name}}%';

UPDATE public.cadenza_message_templates
SET
  body = E'Hola {{customer_name}}, le escribimos de {{company_name}} por el servicio en {{property_address}} ({{scheduled_date}}). Se reportó: {{issue_details}}. ¿Alguna pregunta?',
  updated_at = NOW()
WHERE channel = 'sms'
  AND is_default IS TRUE
  AND body LIKE '%{{technician_name}}%';
