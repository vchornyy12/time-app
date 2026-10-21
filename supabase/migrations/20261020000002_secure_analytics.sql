-- Canonical migration for the SQL mitigation manually applied on production.
-- Preserves the production return type (json) and function body.
-- Do not replay migration 007 directly: it returns jsonb instead of json.
BEGIN;
ALTER FUNCTION public.get_analytics(uuid, timestamptz) SECURITY INVOKER;
ALTER FUNCTION public.get_analytics(uuid, timestamptz) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.get_analytics(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics(uuid, timestamptz) TO authenticated, service_role;
COMMIT;
