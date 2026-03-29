-- Visit reason catalog (per company), job source, route stop day/frequency for pattern generation.

-- ---------------------------------------------------------------------------
-- caicos_visit_reasons
-- ---------------------------------------------------------------------------
CREATE TABLE caicos_visit_reasons (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES caicos_companies(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT caicos_visit_reasons_company_slug_unique UNIQUE (company_id, slug)
);

CREATE INDEX idx_caicos_visit_reasons_company ON caicos_visit_reasons(company_id);

ALTER TABLE caicos_visit_reasons ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view company visit reasons"
  ON caicos_visit_reasons FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "Admins can manage visit reasons"
  ON caicos_visit_reasons FOR ALL
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'))
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- Seed defaults for existing companies
INSERT INTO caicos_visit_reasons (company_id, slug, label, sort_order)
SELECT c.id, v.slug, v.label, v.ord
FROM caicos_companies c
CROSS JOIN (VALUES
  ('routine', 'Routine service', 0),
  ('repair', 'Repair', 10),
  ('warranty', 'Warranty', 20),
  ('opening', 'Opening', 30),
  ('quote', 'Quote / estimate', 40),
  ('callback', 'Callback', 50),
  ('other', 'Other', 100)
) AS v(slug, label, ord)
ON CONFLICT ON CONSTRAINT caicos_visit_reasons_company_slug_unique DO NOTHING;

-- ---------------------------------------------------------------------------
-- Route stops: per-stop weekday + weekly vs monthly (nth weekday of month)
-- day_of_week: 0=Sunday .. 6=Saturday (same as JavaScript Date.getDay())
-- ---------------------------------------------------------------------------
ALTER TABLE caicos_route_stops
  ADD COLUMN day_of_week SMALLINT,
  ADD COLUMN service_frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (service_frequency IN ('weekly', 'monthly')),
  ADD COLUMN week_ordinal SMALLINT
    CHECK (week_ordinal IS NULL OR (week_ordinal >= 1 AND week_ordinal <= 4));

UPDATE caicos_route_stops s
SET day_of_week = COALESCE(r.day_of_week, 1)
FROM caicos_routes r
WHERE s.route_id = r.id;

UPDATE caicos_route_stops SET day_of_week = 1 WHERE day_of_week IS NULL;

ALTER TABLE caicos_route_stops ALTER COLUMN day_of_week SET NOT NULL;

ALTER TABLE caicos_route_stops
  ADD CONSTRAINT caicos_route_stops_dow_chk CHECK (day_of_week >= 0 AND day_of_week <= 6);

ALTER TABLE caicos_route_stops
  ADD CONSTRAINT caicos_route_stops_schedule_chk CHECK (
    (service_frequency = 'weekly' AND week_ordinal IS NULL)
    OR (service_frequency = 'monthly' AND week_ordinal IS NOT NULL)
  );

COMMENT ON COLUMN caicos_routes.day_of_week IS 'Deprecated for scheduling: use caicos_route_stops.day_of_week per stop.';

-- ---------------------------------------------------------------------------
-- Jobs: pattern vs ad-hoc; optional visit kind (FK to company reasons)
-- ---------------------------------------------------------------------------
ALTER TABLE caicos_service_jobs
  ADD COLUMN job_source TEXT NOT NULL DEFAULT 'route'
    CHECK (job_source IN ('route', 'ad_hoc')),
  ADD COLUMN visit_kind_id UUID REFERENCES caicos_visit_reasons(id) ON DELETE SET NULL;

CREATE INDEX idx_caicos_service_jobs_job_source ON caicos_service_jobs(company_id, job_source);
CREATE INDEX idx_caicos_service_jobs_visit_kind ON caicos_service_jobs(visit_kind_id);

-- At most one route-generated job per route/property/date (idempotent generation)
CREATE UNIQUE INDEX caicos_service_jobs_route_property_date_unique
  ON caicos_service_jobs (route_id, property_id, scheduled_date)
  WHERE job_source = 'route' AND route_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- New companies: seed visit reasons (extend signup trigger)
-- ---------------------------------------------------------------------------
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
    INSERT INTO caicos_companies (name)
    VALUES (trim(NEW.raw_user_meta_data->>'company_name'))
    RETURNING id INTO new_company_id;

    INSERT INTO caicos_profiles (id, company_id, role, full_name)
    VALUES (
      NEW.id,
      new_company_id,
      'owner',
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email)
    );

    INSERT INTO caicos_visit_reasons (company_id, slug, label, sort_order) VALUES
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

    INSERT INTO caicos_profiles (id, company_id, role, full_name)
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
