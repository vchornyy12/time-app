-- Make existing installations independent of automatic Data API grants.
-- Named tables only: future tables must declare their own grants and RLS.
BEGIN;

-- Explicit Data API privileges; row access remains controlled by RLS.
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.projects, public.tasks, public.user_integrations, public.user_contexts, public.daily_reflections, public.clarity_sessions
TO authenticated, service_role;

COMMIT;
