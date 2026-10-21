-- No data changes. Preserve CRUD and RLS while removing legacy ALL grants.
BEGIN;
REVOKE ALL ON public.tasks, public.projects, public.user_contexts,
  public.user_integrations, public.daily_reflections, public.clarity_sessions,
  public.user_preferences FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.tasks, public.projects,
  public.user_contexts, public.user_integrations, public.daily_reflections,
  public.clarity_sessions, public.user_preferences FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tasks, public.projects,
  public.user_contexts, public.user_integrations, public.daily_reflections,
  public.clarity_sessions, public.user_preferences TO authenticated, service_role;
COMMIT;
