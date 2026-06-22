-- Extensions are installed in the `extensions` schema on Supabase hosted.
-- Migrations reference uuid_generate_v4() / gen_random_uuid() without schema
-- qualification, so expose thin public wrappers for unqualified calls.
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.uuid_generate_v4()
RETURNS uuid
LANGUAGE sql
VOLATILE
SET search_path = extensions, pg_temp
AS $$ SELECT extensions.uuid_generate_v4() $$;

CREATE OR REPLACE FUNCTION public.gen_random_uuid()
RETURNS uuid
LANGUAGE sql
VOLATILE
SET search_path = extensions, pg_temp
AS $$ SELECT extensions.gen_random_uuid() $$;
