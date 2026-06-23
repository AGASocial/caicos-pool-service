-- Baseline Cadenza multi-tenant schema (companies, profiles, properties, jobs, reports).
-- Required before billing and incremental migrations on a fresh Supabase project.

CREATE TABLE public.cadenza_companies (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free'
    CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cadenza_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'technician'
    CHECK (role IN ('owner', 'admin', 'technician')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cadenza_properties (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  customer_name TEXT NOT NULL,
  customer_email TEXT,
  customer_phone TEXT,
  address TEXT NOT NULL,
  city TEXT,
  state TEXT,
  zip TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  gate_code TEXT,
  pool_type TEXT CHECK (pool_type IN ('residential', 'commercial', 'spa', 'other')),
  pool_surface TEXT CHECK (pool_surface IN ('plaster', 'pebble', 'tile', 'vinyl', 'fiberglass', 'other')),
  equipment_notes TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cadenza_service_jobs (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES public.cadenza_properties(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES public.cadenza_profiles(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
  route_order INTEGER,
  estimated_duration_min INTEGER DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cadenza_service_reports (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES public.cadenza_service_jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES public.cadenza_profiles(id) ON DELETE CASCADE,
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  ph_level NUMERIC(4,2),
  chlorine_level NUMERIC(5,2),
  alkalinity NUMERIC(6,2),
  calcium_hardness NUMERIC(6,2),
  cyanuric_acid NUMERIC(6,2),
  salt_level NUMERIC(7,2),
  water_temp_f NUMERIC(5,1),
  chlorine_added TEXT,
  acid_added TEXT,
  other_chemicals TEXT,
  pump_ok BOOLEAN,
  filter_ok BOOLEAN,
  heater_ok BOOLEAN,
  cleaner_ok BOOLEAN,
  skimmed BOOLEAN DEFAULT FALSE,
  vacuumed BOOLEAN DEFAULT FALSE,
  brushed BOOLEAN DEFAULT FALSE,
  emptied_baskets BOOLEAN DEFAULT FALSE,
  backwashed BOOLEAN DEFAULT FALSE,
  cleaned_filter BOOLEAN DEFAULT FALSE,
  notes TEXT,
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.cadenza_report_photos (
  id UUID PRIMARY KEY DEFAULT public.uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES public.cadenza_service_reports(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.cadenza_companies(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT DEFAULT 'general'
    CHECK (photo_type IN ('before', 'after', 'issue', 'equipment', 'general')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cadenza_profiles_company ON public.cadenza_profiles(company_id);
CREATE INDEX idx_cadenza_properties_company ON public.cadenza_properties(company_id);
CREATE INDEX idx_cadenza_service_jobs_company ON public.cadenza_service_jobs(company_id);
CREATE INDEX idx_cadenza_service_jobs_date ON public.cadenza_service_jobs(scheduled_date);
CREATE INDEX idx_cadenza_service_jobs_tech_date ON public.cadenza_service_jobs(technician_id, scheduled_date);
CREATE INDEX idx_cadenza_service_jobs_property ON public.cadenza_service_jobs(property_id);
CREATE INDEX idx_cadenza_service_reports_job ON public.cadenza_service_reports(job_id);
CREATE INDEX idx_cadenza_report_photos_report ON public.cadenza_report_photos(report_id);

ALTER TABLE public.cadenza_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadenza_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadenza_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadenza_service_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadenza_service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadenza_report_photos ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_my_company_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT company_id FROM public.cadenza_profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.get_my_role()
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT role FROM public.cadenza_profiles WHERE id = auth.uid()
$$;

CREATE POLICY "Users can view own company"
  ON public.cadenza_companies FOR SELECT
  USING (id = public.get_my_company_id());

CREATE POLICY "Owners can update own company"
  ON public.cadenza_companies FOR UPDATE
  USING (id = public.get_my_company_id() AND public.get_my_role() = 'owner');

CREATE POLICY "Users can view company profiles"
  ON public.cadenza_profiles FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Users can update own profile"
  ON public.cadenza_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON public.cadenza_profiles FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view company properties"
  ON public.cadenza_properties FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Admins can manage properties"
  ON public.cadenza_properties FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can update properties"
  ON public.cadenza_properties FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Users can view company jobs"
  ON public.cadenza_service_jobs FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Admins can create jobs"
  ON public.cadenza_service_jobs FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can update jobs"
  ON public.cadenza_service_jobs FOR UPDATE
  USING (company_id = public.get_my_company_id() AND public.get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Techs can update their assigned jobs"
  ON public.cadenza_service_jobs FOR UPDATE
  USING (company_id = public.get_my_company_id() AND technician_id = auth.uid());

CREATE POLICY "Users can view company reports"
  ON public.cadenza_service_reports FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Techs can create reports"
  ON public.cadenza_service_reports FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id() AND technician_id = auth.uid());

CREATE POLICY "Techs can update own reports"
  ON public.cadenza_service_reports FOR UPDATE
  USING (company_id = public.get_my_company_id() AND technician_id = auth.uid());

CREATE POLICY "Users can view company photos"
  ON public.cadenza_report_photos FOR SELECT
  USING (company_id = public.get_my_company_id());

CREATE POLICY "Techs can upload photos"
  ON public.cadenza_report_photos FOR INSERT
  WITH CHECK (company_id = public.get_my_company_id());

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
  IF NEW.raw_user_meta_data->>'company_name' IS NOT NULL
     AND trim(NEW.raw_user_meta_data->>'company_name') != '' THEN
    INSERT INTO public.cadenza_companies (name)
    VALUES (trim(NEW.raw_user_meta_data->>'company_name'))
    RETURNING id INTO new_company_id;

    INSERT INTO public.cadenza_profiles (id, company_id, role, full_name)
    VALUES (
      NEW.id,
      new_company_id,
      'owner',
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email)
    );
    RETURN NEW;
  END IF;

  meta_company_id := NULLIF(trim(NEW.raw_user_meta_data->>'company_id'), '');
  IF meta_company_id IS NOT NULL AND meta_company_id ~ '^[0-9a-fA-F-]{36}$' THEN
    meta_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'technician');
    IF meta_role NOT IN ('owner', 'admin', 'technician') THEN
      meta_role := 'technician';
    END IF;

    INSERT INTO public.cadenza_profiles (id, company_id, role, full_name)
    VALUES (
      NEW.id,
      meta_company_id::UUID,
      meta_role,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cadenza_companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cadenza_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cadenza_properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cadenza_service_jobs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.cadenza_service_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
