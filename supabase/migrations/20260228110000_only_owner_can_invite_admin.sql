-- Only owners can create invite codes with role 'admin'. Admins and operations can create technician/operations invites.
DROP POLICY IF EXISTS "Admins can create invite codes" ON caicos_invite_codes;
CREATE POLICY "Admins can create invite codes"
  ON caicos_invite_codes FOR INSERT
  WITH CHECK (
    company_id = get_my_company_id()
    AND get_my_role() IN ('owner', 'admin', 'operations')
    AND (role <> 'admin' OR get_my_role() = 'owner')
  );
