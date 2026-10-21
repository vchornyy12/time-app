-- Metadata only. Does not read task contents, tokens, or account emails.
SELECT c.relname, c.relrowsecurity AS rls,
  has_table_privilege('anon', c.oid, 'SELECT') AS anon_select,
  has_table_privilege('authenticated', c.oid, 'TRUNCATE') AS authenticated_truncate
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind IN ('r','p','v','m') ORDER BY 1;

SELECT p.oid::regprocedure, p.prosecdef, p.proconfig,
  r.rolname AS owner, r.rolbypassrls AS owner_bypasses_rls,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN pg_roles r ON r.oid = p.proowner WHERE n.nspname = 'public' ORDER BY 1;

SELECT tablename, policyname, roles, cmd, qual, with_check
FROM pg_policies WHERE schemaname IN ('public', 'storage') ORDER BY schemaname, tablename, cmd;

SELECT id, public, file_size_limit, allowed_mime_types FROM storage.buckets;

SELECT pg_get_functiondef('public.get_analytics(uuid,timestamptz)'::regprocedure);
