-- Reconcile the table already present in production with reproducible installs.
-- Production metadata verified on 2026-10-20; existing rows are preserved.
BEGIN;

CREATE TABLE IF NOT EXISTS public.user_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  last_weekly_review timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'user_preferences'
      AND policyname = 'user owns preferences'
  ) THEN
    CREATE POLICY "user owns preferences" ON public.user_preferences
      FOR ALL
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END;
$$;

-- Private preferences do not need anonymous access or DDL-like privileges.
REVOKE ALL ON public.user_preferences FROM PUBLIC, anon;
REVOKE TRUNCATE, REFERENCES, TRIGGER ON public.user_preferences FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences
  TO authenticated, service_role;

COMMIT;
