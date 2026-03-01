-- Add 'operations' role: admin-portal access for operations only (no billing).
-- Operations can manage jobs, routes, team, properties, reports; billing/settings can be restricted in UI.

-- 1. Allow 'operations' in caicos_profiles.role
ALTER TABLE caicos_profiles
  DROP CONSTRAINT IF EXISTS caicos_profiles_role_check;
ALTER TABLE caicos_profiles
  ADD CONSTRAINT caicos_profiles_role_check
  CHECK (role IN ('owner', 'admin', 'technician', 'operations'));

-- 2. Allow 'operations' in caicos_invite_codes.role
ALTER TABLE caicos_invite_codes
  DROP CONSTRAINT IF EXISTS caicos_invite_codes_role_check;
ALTER TABLE caicos_invite_codes
  ADD CONSTRAINT caicos_invite_codes_role_check
  CHECK (role IN ('admin', 'technician', 'operations'));

-- 3. handle_new_user: accept 'operations' from invite metadata
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
    RETURN NEW;
  END IF;

  meta_company_id := NULLIF(trim(NEW.raw_user_meta_data->>'company_id'), '');
  IF meta_company_id IS NOT NULL AND meta_company_id ~ '^[0-9a-fA-F-]{36}$' THEN
    meta_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'technician');
    IF meta_role NOT IN ('owner', 'admin', 'technician', 'operations') THEN
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

-- 4. RLS: grant operations same data access as admin (billing/settings restricted in app)
DROP POLICY IF EXISTS "Admins can insert profiles" ON caicos_profiles;
CREATE POLICY "Admins can insert profiles"
  ON caicos_profiles FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));

DROP POLICY IF EXISTS "Admins can manage properties" ON caicos_properties;
CREATE POLICY "Admins can manage properties"
  ON caicos_properties FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));

DROP POLICY IF EXISTS "Admins can update properties" ON caicos_properties;
CREATE POLICY "Admins can update properties"
  ON caicos_properties FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));

DROP POLICY IF EXISTS "Admins can manage routes" ON caicos_routes;
CREATE POLICY "Admins can manage routes"
  ON caicos_routes FOR ALL
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'))
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));

DROP POLICY IF EXISTS "Admins can manage route stops" ON caicos_route_stops;
CREATE POLICY "Admins can manage route stops"
  ON caicos_route_stops FOR ALL
  USING (EXISTS (SELECT 1 FROM caicos_routes r WHERE r.id = route_id AND r.company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations')))
  WITH CHECK (EXISTS (SELECT 1 FROM caicos_routes r WHERE r.id = route_id AND r.company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations')));

DROP POLICY IF EXISTS "Admins can create jobs" ON caicos_service_jobs;
CREATE POLICY "Admins can create jobs"
  ON caicos_service_jobs FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));

DROP POLICY IF EXISTS "Admins can update jobs" ON caicos_service_jobs;
CREATE POLICY "Admins can update jobs"
  ON caicos_service_jobs FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));

DROP POLICY IF EXISTS "Admins can view company invite codes" ON caicos_invite_codes;
CREATE POLICY "Admins can view company invite codes"
  ON caicos_invite_codes FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));

DROP POLICY IF EXISTS "Admins can create invite codes" ON caicos_invite_codes;
CREATE POLICY "Admins can create invite codes"
  ON caicos_invite_codes FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));

DROP POLICY IF EXISTS "Admins can update invite codes" ON caicos_invite_codes;
CREATE POLICY "Admins can update invite codes"
  ON caicos_invite_codes FOR UPDATE
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin', 'operations'));
