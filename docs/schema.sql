-- ============================================
-- Pool Service Pro - Supabase Schema
-- Multi-tenant SaaS with Row Level Security
-- Generated from Supabase schema export (Digital Asset Files Retrieval)
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Companies (tenants)
CREATE TABLE cadenza_companies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  logo_url TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  subscription_tier TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User profiles (extends Supabase auth.users)
CREATE TABLE cadenza_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('owner', 'admin', 'technician')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invite codes (for inviting technicians/admins to a company)
CREATE TABLE cadenza_invite_codes (
  code TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('owner', 'admin', 'technician')),
  created_by UUID REFERENCES cadenza_profiles(id) ON DELETE SET NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties (customer pools / houses)
CREATE TABLE cadenza_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
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

-- Routes: same technician, territory / grouping. Per-stop weekday & frequency live on cadenza_route_stops.
-- cadenza_routes.day_of_week is deprecated for scheduling (use stops).
-- "Cancel this week for one house" = job row with status 'cancelled' for that visit.
CREATE TABLE cadenza_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  technician_id UUID NOT NULL REFERENCES cadenza_profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Visit reasons (dispatcher / job labeling). Seeded per company on signup.
CREATE TABLE cadenza_visit_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cadenza_visit_reasons_company_slug_unique UNIQUE (company_id, slug)
);

-- Route stops: property on route + pattern (weekday, weekly vs monthly nth weekday). stop_order is display-only (not unique).
-- day_of_week: 0=Sunday .. 6=Saturday (JavaScript Date.getDay).
CREATE TABLE cadenza_route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES cadenza_routes(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES cadenza_properties(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  service_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (service_frequency IN ('weekly', 'monthly')),
  week_ordinal SMALLINT CHECK (week_ordinal IS NULL OR (week_ordinal >= 1 AND week_ordinal <= 4)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cadenza_route_stops_property_id_unique UNIQUE (property_id),
  CONSTRAINT cadenza_route_stops_schedule_chk CHECK (
    (service_frequency = 'weekly' AND week_ordinal IS NULL)
    OR (service_frequency = 'monthly' AND week_ordinal IS NOT NULL)
  )
);

-- Effective-dated schedule segments per stop (pattern can change after effective_from).
CREATE TABLE cadenza_route_stop_schedules (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_stop_id UUID NOT NULL REFERENCES cadenza_route_stops(id) ON DELETE CASCADE,
  day_of_week SMALLINT NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  service_frequency TEXT NOT NULL DEFAULT 'weekly' CHECK (service_frequency IN ('weekly', 'monthly')),
  week_ordinal SMALLINT CHECK (week_ordinal IS NULL OR (week_ordinal >= 1 AND week_ordinal <= 4)),
  effective_from DATE NOT NULL,
  effective_until DATE NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cadenza_route_stop_schedules_schedule_chk CHECK (
    (service_frequency = 'weekly' AND week_ordinal IS NULL)
    OR (service_frequency = 'monthly' AND week_ordinal IS NOT NULL)
  ),
  CONSTRAINT cadenza_route_stop_schedules_until_chk CHECK (
    effective_until IS NULL OR effective_until >= effective_from
  ),
  CONSTRAINT cadenza_route_stop_schedules_stop_from_unique UNIQUE (route_stop_id, effective_from)
);

-- Service jobs (dated instances for billing/history). job_source: route = from pattern generation; ad_hoc = dispatcher/manual.
CREATE TABLE cadenza_service_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES cadenza_properties(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES cadenza_profiles(id) ON DELETE SET NULL,
  route_id UUID REFERENCES cadenza_routes(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
  route_order INTEGER,
  estimated_duration_min INTEGER DEFAULT 30,
  notes TEXT,
  job_source TEXT NOT NULL DEFAULT 'route' CHECK (job_source IN ('route', 'ad_hoc')),
  visit_kind_id UUID REFERENCES cadenza_visit_reasons(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX cadenza_service_jobs_route_property_date_unique
  ON cadenza_service_jobs (route_id, property_id, scheduled_date)
  WHERE job_source = 'route' AND route_id IS NOT NULL;

-- Service reports (filled out during/after service)
CREATE TABLE cadenza_service_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES cadenza_service_jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES cadenza_profiles(id) ON DELETE CASCADE,
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

-- Report photos
CREATE TABLE cadenza_report_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES cadenza_service_reports(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT DEFAULT 'general' CHECK (photo_type IN ('before', 'after', 'issue', 'equipment', 'general')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_cadenza_profiles_company ON cadenza_profiles(company_id);
CREATE INDEX idx_cadenza_invite_codes_company ON cadenza_invite_codes(company_id);
CREATE INDEX idx_cadenza_invite_codes_expires ON cadenza_invite_codes(expires_at) WHERE used_at IS NULL;
CREATE INDEX idx_cadenza_properties_company ON cadenza_properties(company_id);
CREATE INDEX idx_cadenza_routes_company ON cadenza_routes(company_id);
CREATE INDEX idx_cadenza_routes_technician ON cadenza_routes(technician_id);
CREATE INDEX idx_cadenza_route_stops_route ON cadenza_route_stops(route_id);
CREATE INDEX idx_cadenza_route_stop_schedules_stop ON cadenza_route_stop_schedules(route_stop_id);
CREATE INDEX idx_cadenza_route_stop_schedules_from ON cadenza_route_stop_schedules(route_stop_id, effective_from);
CREATE INDEX idx_cadenza_visit_reasons_company ON cadenza_visit_reasons(company_id);
CREATE INDEX idx_cadenza_service_jobs_company ON cadenza_service_jobs(company_id);
CREATE INDEX idx_cadenza_service_jobs_route ON cadenza_service_jobs(route_id);
CREATE INDEX idx_cadenza_service_jobs_date ON cadenza_service_jobs(scheduled_date);
CREATE INDEX idx_cadenza_service_jobs_tech_date ON cadenza_service_jobs(technician_id, scheduled_date);
CREATE INDEX idx_cadenza_service_jobs_property ON cadenza_service_jobs(property_id);
CREATE INDEX idx_cadenza_service_jobs_job_source ON cadenza_service_jobs(company_id, job_source);
CREATE INDEX idx_cadenza_service_jobs_visit_kind ON cadenza_service_jobs(visit_kind_id);
CREATE INDEX idx_cadenza_service_reports_job ON cadenza_service_reports(job_id);
CREATE INDEX idx_cadenza_report_photos_report ON cadenza_report_photos(report_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE cadenza_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_invite_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_route_stop_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_visit_reasons ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_service_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_report_photos ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's company_id
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM cadenza_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM cadenza_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Companies: users can only see their own company
CREATE POLICY "Users can view own company"
  ON cadenza_companies FOR SELECT
  USING (id = get_my_company_id());

CREATE POLICY "Owners can update own company"
  ON cadenza_companies FOR UPDATE
  USING (id = get_my_company_id() AND get_my_role() = 'owner');

-- Profiles: users can see teammates, owners/admins can manage
CREATE POLICY "Users can view company profiles"
  ON cadenza_profiles FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Users can update own profile"
  ON cadenza_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON cadenza_profiles FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- Properties: company-scoped access
CREATE POLICY "Users can view company properties"
  ON cadenza_properties FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins can manage properties"
  ON cadenza_properties FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can update properties"
  ON cadenza_properties FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- Routes: company-scoped, admins manage
CREATE POLICY "Users can view company routes"
  ON cadenza_routes FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins can manage routes"
  ON cadenza_routes FOR ALL
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'))
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- Route stops: via route's company
CREATE POLICY "Users can view company route stops"
  ON cadenza_route_stops FOR SELECT
  USING (EXISTS (SELECT 1 FROM cadenza_routes r WHERE r.id = route_id AND r.company_id = get_my_company_id()));

CREATE POLICY "Admins can manage route stops"
  ON cadenza_route_stops FOR ALL
  USING (EXISTS (SELECT 1 FROM cadenza_routes r WHERE r.id = route_id AND r.company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM cadenza_routes r WHERE r.id = route_id AND r.company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin')));

CREATE POLICY "Users can view company route stop schedules"
  ON cadenza_route_stop_schedules FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM cadenza_route_stops s
      JOIN cadenza_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id AND r.company_id = get_my_company_id()
    )
  );

CREATE POLICY "Admins can manage route stop schedules"
  ON cadenza_route_stop_schedules FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM cadenza_route_stops s
      JOIN cadenza_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id
        AND r.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM cadenza_route_stops s
      JOIN cadenza_routes r ON r.id = s.route_id
      WHERE s.id = route_stop_id
        AND r.company_id = get_my_company_id()
        AND get_my_role() IN ('owner', 'admin')
    )
  );

-- Visit reasons: company catalog
CREATE POLICY "Users can view company visit reasons"
  ON cadenza_visit_reasons FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins can manage visit reasons"
  ON cadenza_visit_reasons FOR ALL
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'))
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- Service jobs: company-scoped, techs see their own
CREATE POLICY "Users can view company jobs"
  ON cadenza_service_jobs FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins can create jobs"
  ON cadenza_service_jobs FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can update jobs"
  ON cadenza_service_jobs FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Techs can update their assigned jobs"
  ON cadenza_service_jobs FOR UPDATE
  USING (company_id = get_my_company_id() AND technician_id = auth.uid());

-- Service reports: techs can create for their jobs
CREATE POLICY "Users can view company reports"
  ON cadenza_service_reports FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Techs can create reports"
  ON cadenza_service_reports FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND technician_id = auth.uid());

CREATE POLICY "Techs can update own reports"
  ON cadenza_service_reports FOR UPDATE
  USING (company_id = get_my_company_id() AND technician_id = auth.uid());

-- Report photos: follow report access
CREATE POLICY "Users can view company photos"
  ON cadenza_report_photos FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Techs can upload photos"
  ON cadenza_report_photos FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

-- Invite codes: admins create and view; used_at updated when code is consumed
CREATE POLICY "Admins can view company invite codes"
  ON cadenza_invite_codes FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can create invite codes"
  ON cadenza_invite_codes FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can update invite codes"
  ON cadenza_invite_codes FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- ============================================
-- STORAGE BUCKET
-- ============================================

-- Run in Supabase dashboard or via API:
-- INSERT INTO storage.buckets (id, name, public) VALUES ('report-photos', 'report-photos', false);

-- Storage policies (photos bucket)
-- CREATE POLICY "Company users can upload photos"
--   ON storage.objects FOR INSERT
--   WITH CHECK (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = get_my_company_id()::text);

-- CREATE POLICY "Company users can view photos"
--   ON storage.objects FOR SELECT
--   USING (bucket_id = 'report-photos' AND (storage.foldername(name))[1] = get_my_company_id()::text);

-- ============================================
-- FUNCTIONS
-- ============================================

-- Auto-create profile + company on signup (SET search_path and UUID validation avoid "Database error saving new user")
CREATE OR REPLACE FUNCTION handle_new_user()
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

    INSERT INTO cadenza_profiles (id, company_id, role, full_name)
    VALUES (
      NEW.id,
      new_company_id,
      'owner',
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email)
    );

    INSERT INTO cadenza_visit_reasons (company_id, slug, label, sort_order) VALUES
      (new_company_id, 'routine', 'Routine service', 0),
      (new_company_id, 'repair', 'Repair', 10),
      (new_company_id, 'warranty', 'Warranty', 20),
      (new_company_id, 'opening', 'Opening', 30),
      (new_company_id, 'quote', 'Quote / estimate', 40),
      (new_company_id, 'callback', 'Callback', 50),
      (new_company_id, 'other', 'Other', 100);

    RETURN NEW;
  END IF;

  meta_company_id := NULLIF(trim(NEW.raw_user_meta_data->>'company_id'), '');
  IF meta_company_id IS NOT NULL AND meta_company_id ~ '^[0-9a-fA-F-]{36}$' THEN
    meta_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'technician');
    IF meta_role NOT IN ('owner', 'admin', 'technician') THEN
      meta_role := 'technician';
    END IF;

    INSERT INTO cadenza_profiles (id, company_id, role, full_name)
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

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated_at auto-update trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at BEFORE UPDATE ON cadenza_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cadenza_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cadenza_properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cadenza_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cadenza_service_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cadenza_service_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
