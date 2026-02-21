-- ============================================
-- Pool Service Pro - Supabase Schema
-- Multi-tenant SaaS with Row Level Security
-- ============================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLES
-- ============================================

-- Companies (tenants)
CREATE TABLE caicos_companies (
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
CREATE TABLE caicos_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES caicos_companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('owner', 'admin', 'technician')),
  full_name TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties (customer pools)
CREATE TABLE caicos_properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES caicos_companies(id) ON DELETE CASCADE,
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

-- Service jobs (scheduled visits)
CREATE TABLE caicos_service_jobs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES caicos_companies(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES caicos_properties(id) ON DELETE CASCADE,
  technician_id UUID REFERENCES caicos_profiles(id),
  scheduled_date DATE NOT NULL,
  scheduled_time TIME,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'skipped', 'cancelled')),
  route_order INTEGER,
  estimated_duration_min INTEGER DEFAULT 30,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service reports (filled out during/after service)
CREATE TABLE caicos_service_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  job_id UUID NOT NULL REFERENCES caicos_service_jobs(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES caicos_companies(id) ON DELETE CASCADE,
  technician_id UUID NOT NULL REFERENCES caicos_profiles(id),
  arrival_time TIMESTAMPTZ,
  departure_time TIMESTAMPTZ,
  -- Chemical readings
  ph_level NUMERIC(4,2),
  chlorine_level NUMERIC(5,2),
  alkalinity NUMERIC(6,2),
  calcium_hardness NUMERIC(6,2),
  cyanuric_acid NUMERIC(6,2),
  salt_level NUMERIC(7,2),
  water_temp_f NUMERIC(5,1),
  -- Chemicals added
  chlorine_added TEXT,
  acid_added TEXT,
  other_chemicals TEXT,
  -- Equipment checks
  pump_ok BOOLEAN,
  filter_ok BOOLEAN,
  heater_ok BOOLEAN,
  cleaner_ok BOOLEAN,
  -- Tasks
  skimmed BOOLEAN DEFAULT FALSE,
  vacuumed BOOLEAN DEFAULT FALSE,
  brushed BOOLEAN DEFAULT FALSE,
  emptied_baskets BOOLEAN DEFAULT FALSE,
  backwashed BOOLEAN DEFAULT FALSE,
  cleaned_filter BOOLEAN DEFAULT FALSE,
  -- Notes
  notes TEXT,
  follow_up_needed BOOLEAN DEFAULT FALSE,
  follow_up_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Report photos
CREATE TABLE caicos_report_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES caicos_service_reports(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES caicos_companies(id) ON DELETE CASCADE,
  storage_path TEXT NOT NULL,
  caption TEXT,
  photo_type TEXT DEFAULT 'general' CHECK (photo_type IN ('before', 'after', 'issue', 'equipment', 'general')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_caicos_profiles_company ON caicos_profiles(company_id);
CREATE INDEX idx_caicos_properties_company ON caicos_properties(company_id);
CREATE INDEX idx_caicos_service_jobs_company ON caicos_service_jobs(company_id);
CREATE INDEX idx_caicos_service_jobs_date ON caicos_service_jobs(scheduled_date);
CREATE INDEX idx_caicos_service_jobs_tech_date ON caicos_service_jobs(technician_id, scheduled_date);
CREATE INDEX idx_caicos_service_jobs_property ON caicos_service_jobs(property_id);
CREATE INDEX idx_caicos_service_reports_job ON caicos_service_reports(job_id);
CREATE INDEX idx_caicos_report_photos_report ON caicos_report_photos(report_id);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE caicos_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE caicos_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE caicos_properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE caicos_service_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE caicos_service_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE caicos_report_photos ENABLE ROW LEVEL SECURITY;

-- Helper function: get current user's company_id
CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM caicos_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Helper function: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM caicos_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Companies: users can only see their own company
CREATE POLICY "Users can view own company"
  ON caicos_companies FOR SELECT
  USING (id = get_my_company_id());

CREATE POLICY "Owners can update own company"
  ON caicos_companies FOR UPDATE
  USING (id = get_my_company_id() AND get_my_role() = 'owner');

-- Profiles: users can see teammates, owners/admins can manage
CREATE POLICY "Users can view company profiles"
  ON caicos_profiles FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Users can update own profile"
  ON caicos_profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "Admins can insert profiles"
  ON caicos_profiles FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- Properties: company-scoped access
CREATE POLICY "Users can view company properties"
  ON caicos_properties FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins can manage properties"
  ON caicos_properties FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can update properties"
  ON caicos_properties FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- Service jobs: company-scoped, techs see their own
CREATE POLICY "Users can view company jobs"
  ON caicos_service_jobs FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins can create jobs"
  ON caicos_service_jobs FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can update jobs"
  ON caicos_service_jobs FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Techs can update their assigned jobs"
  ON caicos_service_jobs FOR UPDATE
  USING (company_id = get_my_company_id() AND technician_id = auth.uid());

-- Service reports: techs can create for their jobs
CREATE POLICY "Users can view company reports"
  ON caicos_service_reports FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Techs can create reports"
  ON caicos_service_reports FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND technician_id = auth.uid());

CREATE POLICY "Techs can update own reports"
  ON caicos_service_reports FOR UPDATE
  USING (company_id = get_my_company_id() AND technician_id = auth.uid());

-- Report photos: follow report access
CREATE POLICY "Users can view company photos"
  ON caicos_report_photos FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Techs can upload photos"
  ON caicos_report_photos FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

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

-- Auto-create profile + company on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_company_id UUID;
BEGIN
  -- If company_name is provided in metadata, create a new company
  IF NEW.raw_user_meta_data->>'company_name' IS NOT NULL THEN
    INSERT INTO caicos_companies (name)
    VALUES (NEW.raw_user_meta_data->>'company_name')
    RETURNING id INTO new_company_id;

    INSERT INTO caicos_profiles (id, company_id, role, full_name)
    VALUES (
      NEW.id,
      new_company_id,
      'owner',
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
  -- If company_id is provided (invite flow), join existing company
  ELSIF NEW.raw_user_meta_data->>'company_id' IS NOT NULL THEN
    INSERT INTO caicos_profiles (id, company_id, role, full_name)
    VALUES (
      NEW.id,
      (NEW.raw_user_meta_data->>'company_id')::UUID,
      COALESCE(NEW.raw_user_meta_data->>'role', 'technician'),
      COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on auth.users insert
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

CREATE TRIGGER set_updated_at BEFORE UPDATE ON caicos_companies FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON caicos_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON caicos_properties FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON caicos_service_jobs FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER set_updated_at BEFORE UPDATE ON caicos_service_reports FOR EACH ROW EXECUTE FUNCTION update_updated_at();
