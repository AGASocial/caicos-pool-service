-- US-D-003: Denormalize email_confirmed_at on cadenza_profiles (unblocks US-B-005)

ALTER TABLE public.cadenza_profiles
  ADD COLUMN IF NOT EXISTS email_confirmed_at TIMESTAMPTZ;

-- Backfill from auth.users (idempotent)
UPDATE public.cadenza_profiles p
SET email_confirmed_at = u.email_confirmed_at
FROM auth.users u
WHERE p.id = u.id
  AND u.email_confirmed_at IS NOT NULL
  AND (p.email_confirmed_at IS DISTINCT FROM u.email_confirmed_at);

-- Sync on auth.users email confirmation changes
CREATE OR REPLACE FUNCTION public.sync_profile_email_confirmed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.cadenza_profiles
  SET email_confirmed_at = NEW.email_confirmed_at
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_email_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_email_confirmed
  AFTER UPDATE OF email_confirmed_at ON auth.users
  FOR EACH ROW
  WHEN (OLD.email_confirmed_at IS DISTINCT FROM NEW.email_confirmed_at)
  EXECUTE FUNCTION public.sync_profile_email_confirmed();

-- Keep new profiles in sync on signup
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

    INSERT INTO cadenza_profiles (id, company_id, role, full_name, email_confirmed_at)
    VALUES (
      NEW.id,
      new_company_id,
      'owner',
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
      NEW.email_confirmed_at
    );
    RETURN NEW;
  END IF;

  meta_company_id := NULLIF(trim(NEW.raw_user_meta_data->>'company_id'), '');
  IF meta_company_id IS NOT NULL AND meta_company_id ~ '^[0-9a-fA-F-]{36}$' THEN
    meta_role := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'role'), ''), 'technician');
    IF meta_role NOT IN ('owner', 'admin', 'technician', 'operations') THEN
      meta_role := 'technician';
    END IF;

    INSERT INTO cadenza_profiles (id, company_id, role, full_name, email_confirmed_at)
    VALUES (
      NEW.id,
      meta_company_id::UUID,
      meta_role,
      COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), NEW.email),
      NEW.email_confirmed_at
    );
  END IF;

  RETURN NEW;
END;
$$;
