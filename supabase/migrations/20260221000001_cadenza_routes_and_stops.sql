-- Cadenza routes and route_stops (for recurring routes).
-- Applied via Supabase MCP apply_migration to project lrnhrzpwgyhkruwxeppw.
-- Run this if your project does not yet have cadenza_routes / cadenza_route_stops.

CREATE TABLE IF NOT EXISTS cadenza_routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  technician_id UUID NOT NULL REFERENCES cadenza_profiles(id) ON DELETE CASCADE,
  day_of_week SMALLINT CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cadenza_route_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  route_id UUID NOT NULL REFERENCES cadenza_routes(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES cadenza_properties(id) ON DELETE CASCADE,
  stop_order INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(route_id, property_id)
);

ALTER TABLE cadenza_service_jobs ADD COLUMN IF NOT EXISTS route_id UUID REFERENCES cadenza_routes(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cadenza_routes_company ON cadenza_routes(company_id);
CREATE INDEX IF NOT EXISTS idx_cadenza_routes_technician ON cadenza_routes(technician_id);
CREATE INDEX IF NOT EXISTS idx_cadenza_route_stops_route ON cadenza_route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_cadenza_service_jobs_route ON cadenza_service_jobs(route_id);

ALTER TABLE cadenza_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cadenza_route_stops ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM cadenza_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM cadenza_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

DROP POLICY IF EXISTS "Users can view company routes" ON cadenza_routes;
CREATE POLICY "Users can view company routes"
  ON cadenza_routes FOR SELECT
  USING (company_id = get_my_company_id());

DROP POLICY IF EXISTS "Admins can manage routes" ON cadenza_routes;
CREATE POLICY "Admins can manage routes"
  ON cadenza_routes FOR ALL
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'))
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

DROP POLICY IF EXISTS "Users can view company route stops" ON cadenza_route_stops;
CREATE POLICY "Users can view company route stops"
  ON cadenza_route_stops FOR SELECT
  USING (EXISTS (SELECT 1 FROM cadenza_routes r WHERE r.id = route_id AND r.company_id = get_my_company_id()));

DROP POLICY IF EXISTS "Admins can manage route stops" ON cadenza_route_stops;
CREATE POLICY "Admins can manage route stops"
  ON cadenza_route_stops FOR ALL
  USING (EXISTS (SELECT 1 FROM cadenza_routes r WHERE r.id = route_id AND r.company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM cadenza_routes r WHERE r.id = route_id AND r.company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin')));

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_updated_at ON cadenza_routes;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON cadenza_routes FOR EACH ROW EXECUTE FUNCTION update_updated_at();
