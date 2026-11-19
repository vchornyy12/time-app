-- AI agent capture (FS-001): source metadata on tasks, per-source cursors,
-- an append-only audit log, and database-level limits for OAuth agent tokens.
--
-- Agent tokens are access tokens that Supabase's OAuth 2.1 server issues to a
-- registered client (Claude, ChatGPT). They carry a `client_id` claim; ordinary
-- app sessions do not. Restrictive policies below let such a token capture new
-- Inbox tasks and nothing else, so the "agent proposes, human processes" rule
-- holds even if a token is used outside the MCP endpoint.
BEGIN;

-- ── Source metadata on tasks ──────────────────────────────────────────────
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS source          text,
  ADD COLUMN IF NOT EXISTS source_ref      text,
  ADD COLUMN IF NOT EXISTS source_url      text,
  ADD COLUMN IF NOT EXISTS source_quote    text,
  ADD COLUMN IF NOT EXISTS dedupe_key      text,
  ADD COLUMN IF NOT EXISTS agent_proposal  jsonb,
  ADD COLUMN IF NOT EXISTS captured_by     text;

DO $$
DECLARE rule record;
BEGIN
  FOR rule IN SELECT * FROM (VALUES
    ('tasks_source_values', 'source IS NULL OR source IN (''gmail'',''bluedot'',''google_chat'',''slack'',''jira'',''calendar'',''meeting'',''other'')'),
    ('tasks_source_ref_bounds', 'source_ref IS NULL OR length(source_ref) BETWEEN 1 AND 300'),
    ('tasks_source_url_bounds', 'source_url IS NULL OR (length(source_url) <= 2000 AND source_url ~ ''^https://'')'),
    ('tasks_source_quote_bounds', 'source_quote IS NULL OR length(source_quote) <= 1000'),
    ('tasks_dedupe_key_bounds', 'dedupe_key IS NULL OR length(dedupe_key) BETWEEN 1 AND 200'),
    ('tasks_agent_proposal_bounds', 'agent_proposal IS NULL OR (jsonb_typeof(agent_proposal) = ''object'' AND octet_length(agent_proposal::text) <= 4000)'),
    ('tasks_captured_by_bounds', 'captured_by IS NULL OR length(captured_by) BETWEEN 1 AND 200')
  ) AS rules(constraint_name, expression)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = rule.constraint_name
      AND conrelid = 'public.tasks'::regclass) THEN
      EXECUTE format('ALTER TABLE public.tasks ADD CONSTRAINT %I CHECK (%s)', rule.constraint_name, rule.expression);
    END IF;
  END LOOP;
END $$;

-- A real constraint (not a partial index) so PostgREST upserts can target it.
-- NULL dedupe keys stay distinct, so manual tasks are unaffected.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_user_dedupe_key_unique') THEN
    ALTER TABLE public.tasks ADD CONSTRAINT tasks_user_dedupe_key_unique UNIQUE (user_id, dedupe_key);
  END IF;
END $$;

-- ── Agent token detection ─────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_agent_token()
RETURNS boolean LANGUAGE sql STABLE SET search_path = '' AS $$
  SELECT coalesce(nullif(auth.jwt() ->> 'client_id', '') IS NOT NULL, false);
$$;
REVOKE ALL ON FUNCTION public.is_agent_token() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_agent_token() TO authenticated, service_role;

-- Tasks: an agent token may insert Inbox tasks only; no update or delete.
DROP POLICY IF EXISTS tasks_agent_insert_inbox_only ON public.tasks;
CREATE POLICY tasks_agent_insert_inbox_only ON public.tasks AS RESTRICTIVE FOR INSERT
  TO authenticated WITH CHECK (NOT public.is_agent_token() OR status = 'inbox');
DROP POLICY IF EXISTS tasks_agent_no_update ON public.tasks;
CREATE POLICY tasks_agent_no_update ON public.tasks AS RESTRICTIVE FOR UPDATE
  TO authenticated USING (NOT public.is_agent_token());
DROP POLICY IF EXISTS tasks_agent_no_delete ON public.tasks;
CREATE POLICY tasks_agent_no_delete ON public.tasks AS RESTRICTIVE FOR DELETE
  TO authenticated USING (NOT public.is_agent_token());

-- Every other user table: an agent token is read-only.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['projects','user_contexts','user_integrations','daily_reflections','clarity_sessions','user_preferences'] LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agent_no_insert', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK (NOT public.is_agent_token())', t || '_agent_no_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agent_no_update', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR UPDATE TO authenticated USING (NOT public.is_agent_token())', t || '_agent_no_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_agent_no_delete', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR DELETE TO authenticated USING (NOT public.is_agent_token())', t || '_agent_no_delete', t);
  END LOOP;
END $$;

-- Storage: an agent token may not upload, change or delete attachment objects.
-- Guarded so the migration also runs where the storage schema is absent.
DO $$ BEGIN
  IF to_regclass('storage.objects') IS NOT NULL THEN
    DROP POLICY IF EXISTS agent_tokens_no_storage_insert ON storage.objects;
    CREATE POLICY agent_tokens_no_storage_insert ON storage.objects AS RESTRICTIVE FOR INSERT
      TO authenticated WITH CHECK (NOT public.is_agent_token());
    DROP POLICY IF EXISTS agent_tokens_no_storage_update ON storage.objects;
    CREATE POLICY agent_tokens_no_storage_update ON storage.objects AS RESTRICTIVE FOR UPDATE
      TO authenticated USING (NOT public.is_agent_token());
    DROP POLICY IF EXISTS agent_tokens_no_storage_delete ON storage.objects;
    CREATE POLICY agent_tokens_no_storage_delete ON storage.objects AS RESTRICTIVE FOR DELETE
      TO authenticated USING (NOT public.is_agent_token());
  END IF;
END $$;

-- ── Per-source cursors (where the last agent run stopped) ─────────────────
CREATE TABLE IF NOT EXISTS public.agent_cursors (
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source      text NOT NULL CHECK (source IN ('gmail','bluedot','google_chat','slack','jira','calendar','meeting','other')),
  cursor      text NOT NULL CHECK (length(cursor) BETWEEN 1 AND 500),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, source)
);
ALTER TABLE public.agent_cursors ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_cursors_select_own ON public.agent_cursors;
CREATE POLICY agent_cursors_select_own ON public.agent_cursors FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS agent_cursors_insert_own ON public.agent_cursors;
CREATE POLICY agent_cursors_insert_own ON public.agent_cursors FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS agent_cursors_update_own ON public.agent_cursors;
CREATE POLICY agent_cursors_update_own ON public.agent_cursors FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS agent_cursors_delete_own ON public.agent_cursors;
CREATE POLICY agent_cursors_delete_own ON public.agent_cursors FOR DELETE TO authenticated USING (user_id = auth.uid() AND NOT public.is_agent_token());
REVOKE ALL ON public.agent_cursors FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agent_cursors TO authenticated, service_role;

-- ── Audit log (append-only for users) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.agent_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id   text CHECK (client_id IS NULL OR length(client_id) <= 200),
  tool        text NOT NULL CHECK (length(tool) BETWEEN 1 AND 100),
  task_id     uuid,
  ok          boolean NOT NULL,
  detail      text CHECK (detail IS NULL OR length(detail) <= 500),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS agent_events_user_created_idx ON public.agent_events (user_id, created_at DESC);
ALTER TABLE public.agent_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS agent_events_select_own ON public.agent_events;
CREATE POLICY agent_events_select_own ON public.agent_events FOR SELECT TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS agent_events_insert_own ON public.agent_events;
CREATE POLICY agent_events_insert_own ON public.agent_events FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
REVOKE ALL ON public.agent_events FROM PUBLIC, anon;
GRANT SELECT, INSERT ON public.agent_events TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.agent_events TO service_role;

COMMIT;
