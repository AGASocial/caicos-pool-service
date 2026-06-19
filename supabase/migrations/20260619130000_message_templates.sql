-- Message templates (email now, SMS later) with merge tags and optional issue mapping.

CREATE TABLE public.cadenza_message_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms')),
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  issue_categories TEXT[] NOT NULL DEFAULT '{}'::TEXT[],
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT message_templates_issue_categories_allowed CHECK (
    issue_categories <@ ARRAY['motor', 'filter', 'circulation', 'timer', 'chemistry', 'other']::TEXT[]
  )
);

CREATE INDEX idx_cadenza_message_templates_company_channel
  ON public.cadenza_message_templates (company_id, channel);

CREATE UNIQUE INDEX cadenza_message_templates_one_default_per_channel
  ON public.cadenza_message_templates (company_id, channel)
  WHERE is_default IS TRUE;

COMMENT ON TABLE public.cadenza_message_templates IS
  'Email/SMS templates with {{merge_tags}}. issue_categories links one template to many issue types; empty = generic fallback when is_default.';

ALTER TABLE public.cadenza_message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Company users can view message templates"
  ON public.cadenza_message_templates FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Office staff can manage message templates"
  ON public.cadenza_message_templates FOR ALL
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin', 'operations')
  );

-- Generic default email template for every company (Spanish — primary locale).
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
  'email',
  'Seguimiento genérico',
  'Seguimiento de servicio — {{property_address}}',
  E'Estimado/a {{customer_name}},

Le escribimos respecto al servicio realizado en {{property_address}} el {{scheduled_date}}.

Nuestro técnico {{technician_name}} reportó lo siguiente durante la visita:

{{issue_details}}

Por favor indíquenos si tiene alguna pregunta o desea que programemos una visita de seguimiento.

Saludos cordiales,
{{company_name}}',
  '{}'::TEXT[],
  TRUE
FROM public.cadenza_companies c
WHERE NOT EXISTS (
  SELECT 1
  FROM public.cadenza_message_templates t
  WHERE t.company_id = c.id
    AND t.channel = 'email'
    AND t.is_default IS TRUE
);
