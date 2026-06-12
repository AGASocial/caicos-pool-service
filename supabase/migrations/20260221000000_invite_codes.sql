-- ============================================
-- Invite codes for technician/admin invites
-- Admin generates link; tech signs up with code
-- ============================================

CREATE TABLE cadenza_invite_codes (
  code TEXT PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES cadenza_companies(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'technician' CHECK (role IN ('admin', 'technician')),
  created_by UUID REFERENCES cadenza_profiles(id),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cadenza_invite_codes_company ON cadenza_invite_codes(company_id);
CREATE INDEX idx_cadenza_invite_codes_expires ON cadenza_invite_codes(expires_at) WHERE used_at IS NULL;

ALTER TABLE cadenza_invite_codes ENABLE ROW LEVEL SECURITY;

-- Only owner/admin can view company invite codes
CREATE POLICY "Admins can view company invite codes"
  ON cadenza_invite_codes FOR SELECT
  USING (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

CREATE POLICY "Admins can create invite codes"
  ON cadenza_invite_codes FOR INSERT
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() IN ('owner', 'admin'));

-- Service role or anon can validate code (returns company_id, role) via function only
-- Technicians sign up with code; we need to allow reading a single row by code for validation
-- Use a SECURITY DEFINER function so signup page can resolve code -> company_id, role
CREATE OR REPLACE FUNCTION get_invite_code_payload(code_input TEXT)
RETURNS TABLE(company_id UUID, role TEXT) AS $$
  SELECT cadenza_invite_codes.company_id, cadenza_invite_codes.role
  FROM cadenza_invite_codes
  WHERE cadenza_invite_codes.code = code_input
    AND used_at IS NULL
    AND expires_at > NOW();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Mark code as used (call after technician signs up; caller must be in same company)
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
$$ LANGUAGE plpgsql SECURITY DEFINER;
