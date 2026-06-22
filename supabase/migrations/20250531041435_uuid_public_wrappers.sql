-- 20250531041430 enables extensions in the `extensions` schema; migrations use
-- unqualified uuid_generate_v4() / gen_random_uuid(). Expose public wrappers.
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
