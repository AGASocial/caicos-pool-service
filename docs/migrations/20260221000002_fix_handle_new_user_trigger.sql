-- Fix handle_new_user trigger: set search_path and validate UUID to avoid "Database error saving new user".
-- Run this in Supabase SQL Editor if you see that error on signup with invite.

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
  -- New company (owner signup)
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

  -- Invite (join existing company): only if company_id looks like a valid UUID
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

-- Trigger already exists; no need to recreate unless dropped
-- DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- CREATE TRIGGER on_auth_user_created
--   AFTER INSERT ON auth.users
--   FOR EACH ROW EXECUTE FUNCTION handle_new_user();
