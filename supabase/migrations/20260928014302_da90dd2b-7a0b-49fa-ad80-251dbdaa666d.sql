CREATE OR REPLACE FUNCTION public.server_now()
RETURNS timestamptz LANGUAGE sql STABLE SET search_path = public AS $$ SELECT now() $$;
GRANT EXECUTE ON FUNCTION public.server_now() TO authenticated, anon;