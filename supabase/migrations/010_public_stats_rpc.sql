CREATE OR REPLACE FUNCTION public.get_public_stats()
RETURNS json
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT json_build_object(
    'user_count', (SELECT COUNT(*) FROM auth.users),
    'task_count', (SELECT COUNT(*) FROM public.tasks)
  );
$$;

GRANT EXECUTE ON FUNCTION public.get_public_stats() TO anon, authenticated;
