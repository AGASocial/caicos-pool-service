-- Catalog of reasons when a technician cannot service a job (skipped visit).
-- Per-company, seeded on migration and for new companies via signup helper.

CREATE TABLE public.cadenza_cant_service_reasons (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cadenza_cant_service_reasons_company_slug_unique UNIQUE (company_id, slug)
);

CREATE INDEX idx_cadenza_cant_service_reasons_company
  ON public.cadenza_cant_service_reasons(company_id);

ALTER TABLE public.cadenza_cant_service_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company cant service reasons"
  ON public.cadenza_cant_service_reasons FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Admins can manage cant service reasons"
  ON public.cadenza_cant_service_reasons FOR ALL
  USING (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin')
  )
  WITH CHECK (
    company_id = public.get_my_company_id()
    AND public.get_my_role() IN ('owner', 'admin')
  );

-- Seed defaults for existing companies
INSERT INTO public.cadenza_cant_service_reasons (company_id, slug, label, sort_order)
SELECT c.id, v.slug, v.label, v.ord
FROM public.cadenza_companies c
CROSS JOIN (VALUES
  ('gate_locked', 'Puerta cerrada', 0),
  ('client_cancelled', 'Cliente canceló', 10),
  ('client_not_home', 'Cliente no está', 20),
  ('dog_in_yard', 'Perro en el patio', 30),
  ('access_blocked', 'Acceso bloqueado', 40),
  ('bad_weather', 'Clima adverso', 50),
  ('pool_under_repair', 'Piscina en reparación', 60),
  ('vehicle_blocking', 'Vehículo bloqueando acceso', 70)
) AS v(slug, label, ord)
ON CONFLICT ON CONSTRAINT cadenza_cant_service_reasons_company_slug_unique DO NOTHING;

-- Selected reason slugs on skip reports (multiselect chips + optional free-text notes)
ALTER TABLE public.cadenza_service_reports
  ADD COLUMN IF NOT EXISTS cant_service_reasons TEXT[] NOT NULL DEFAULT '{}'::TEXT[];

COMMENT ON TABLE public.cadenza_cant_service_reasons IS
  'Company catalog of reasons a technician could not service a scheduled visit.';

COMMENT ON COLUMN public.cadenza_service_reports.cant_service_reasons IS
  'Slugs from cadenza_cant_service_reasons when job was marked skipped via cant-service flow.';

-- Seed cant service reasons when a new company is created on signup
CREATE OR REPLACE FUNCTION public.seed_cant_service_reasons_for_company(p_company_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.cadenza_cant_service_reasons (company_id, slug, label, sort_order) VALUES
    (p_company_id, 'gate_locked', 'Puerta cerrada', 0),
    (p_company_id, 'client_cancelled', 'Cliente canceló', 10),
    (p_company_id, 'client_not_home', 'Cliente no está', 20),
    (p_company_id, 'dog_in_yard', 'Perro en el patio', 30),
    (p_company_id, 'access_blocked', 'Acceso bloqueado', 40),
    (p_company_id, 'bad_weather', 'Clima adverso', 50),
    (p_company_id, 'pool_under_repair', 'Piscina en reparación', 60),
    (p_company_id, 'vehicle_blocking', 'Vehículo bloqueando acceso', 70)
  ON CONFLICT ON CONSTRAINT cadenza_cant_service_reasons_company_slug_unique DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  meta_company_id TEXT;
  meta_role TEXT;
BEGIN
  IF NEW.raw_user_meta_data->>'company_name' IS NOT NULL AND trim(NEW.raw_user_meta_data->>'company_name') != '' THEN
    INSERT INTO cadenza_companies (name)
    VALUES (trim(NEW.raw_user_meta_data->>'company_name'))
    RETURNING id INTO new_company_id;

    INSERT INTO cadenza_profiles (id, company_id, role, full_name, email_confirmed_at)
    VALUES (
      NEW.id,
      new_company_id,
      'owner',
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
      NEW.email_confirmed_at
    );

    PERFORM public.seed_cant_service_reasons_for_company(new_company_id);

    RETURN NEW;
  END IF;

  meta_company_id := NULLIF(trim(NEW.raw_user_meta_data->>'company_id'), '');
  IF meta_company_id IS NOT NULL AND meta_company_id ~ '^[0-9a-fA-F-]{36}$' THEN
    meta_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'technician');
    IF meta_role NOT IN ('owner', 'admin', 'technician', 'operations') THEN
      meta_role := 'technician';
    END IF;

    INSERT INTO cadenza_profiles (id, company_id, role, full_name, email_confirmed_at)
    VALUES (
      NEW.id,
      meta_company_id::UUID,
      meta_role,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
      NEW.email_confirmed_at
    );
  END IF;

  RETURN NEW;
END;
$$;
