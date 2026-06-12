-- Fix stale caicos_* references in Postgres functions after table rename to cadenza_*.
-- Migrations were edited in place after apply; live DB functions still pointed at caicos_profiles.

CREATE OR REPLACE FUNCTION get_my_company_id()
RETURNS UUID AS $$
  SELECT company_id FROM cadenza_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT AS $$
  SELECT role FROM cadenza_profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION get_invite_code_payload(code_input TEXT)
RETURNS TABLE(company_id UUID, role TEXT) AS $$
  SELECT cadenza_invite_codes.company_id, cadenza_invite_codes.role
  FROM cadenza_invite_codes
  WHERE cadenza_invite_codes.code = code_input
    AND used_at IS NULL
    AND expires_at > NOW();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION mark_invite_code_used(code_input TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE cadenza_invite_codes
  SET used_at = NOW()
  WHERE code = code_input
    AND used_at IS NULL
    AND expires_at > NOW()
    AND company_id = get_my_company_id();
  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
