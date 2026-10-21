-- ============================================================
-- GTD App — Consolidated Schema Initialization
-- Purpose: Initialize a fresh Supabase database with all 
-- necessary tables, enums, storage, and RLS permissions.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. ENUMS
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE task_status AS ENUM (
        'inbox',
        'next_actions',
        'waiting_for',
        'calendar',
        'someday_maybe',
        'notes',
        'trash',
        'done'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE project_status AS ENUM (
        'active',
        'completed'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. TABLES
-- ────────────────────────────────────────────────────────────

-- PROJECTS
CREATE TABLE IF NOT EXISTS projects (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id             uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title               text NOT NULL,
    completion_criteria text NOT NULL DEFAULT '',
    rough_plan          jsonb NOT NULL DEFAULT '[]'::jsonb,
    first_step_task_id  uuid,                          -- constraint added after tasks table
    status              project_status NOT NULL DEFAULT 'active',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now()
);

-- TASKS
CREATE TABLE IF NOT EXISTS tasks (
    id                          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id                     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id                  uuid REFERENCES projects(id) ON DELETE SET NULL,
    title                       text NOT NULL,
    status                      task_status NOT NULL DEFAULT 'inbox',
    scheduled_at                timestamptz,
    due_date                    date,
    delegated_to                text,
    is_delegation_communicated  boolean NOT NULL DEFAULT false,
    google_calendar_event_id    text,
    contexts                    text[] NOT NULL DEFAULT '{}',
    attachments                 jsonb NOT NULL DEFAULT '[]'::jsonb,
    created_at                  timestamptz NOT NULL DEFAULT now(),
    updated_at                  timestamptz NOT NULL DEFAULT now(),
    completed_at                timestamptz,
    recurrence_rule             text CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily', 'weekly', 'monthly', 'yearly'))
);

-- Circular reference handling
DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'fk_first_step_task'
    ) THEN
        ALTER TABLE projects
            ADD CONSTRAINT fk_first_step_task
            FOREIGN KEY (first_step_task_id)
            REFERENCES tasks(id)
            ON DELETE SET NULL;
    END IF;
END $$;

-- USER INTEGRATIONS
CREATE TABLE IF NOT EXISTS user_integrations (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    google_refresh_token  text,
    google_calendar_id    text,
    created_at            timestamptz NOT NULL DEFAULT now()
);

-- USER CONTEXTS
CREATE TABLE IF NOT EXISTS user_contexts (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, name)
);

-- ────────────────────────────────────────────────────────────
-- 3. FUNCTIONS & TRIGGERS
-- ────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tasks_updated_at ON tasks;
CREATE TRIGGER tasks_updated_at
    BEFORE UPDATE ON tasks
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS projects_updated_at ON projects;
CREATE TRIGGER projects_updated_at
    BEFORE UPDATE ON projects
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'done' AND (OLD.status IS DISTINCT FROM 'done') THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status != 'done' AND OLD.status = 'done' THEN
    NEW.completed_at = NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_completed_at ON tasks;
CREATE TRIGGER trigger_completed_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_completed_at();

-- When a recurring calendar/next_actions task is completed, insert the next
-- occurrence in the same transaction. Fires on UPDATE, performs INSERT — no
-- recursion. Runs as the invoking role: the clone keeps the same user_id as
-- the completing user, so the RLS insert policy (auth.uid() = user_id) passes.
CREATE OR REPLACE FUNCTION handle_recurring_task_done()
RETURNS trigger AS $$
DECLARE
  step    interval;
  next_at timestamptz;
BEGIN
  step := CASE NEW.recurrence_rule
    WHEN 'daily'   THEN interval '1 day'
    WHEN 'weekly'  THEN interval '7 days'
    WHEN 'monthly' THEN interval '1 month'
    WHEN 'yearly'  THEN interval '1 year'
  END;
  IF step IS NULL THEN
    RETURN NEW;  -- defensive: unknown rule, do nothing
  END IF;

  IF OLD.status = 'calendar' THEN
    -- Advance from the original slot, rolling forward past now() so a task
    -- completed late is scheduled in the future while preserving time of day.
    next_at := COALESCE(OLD.scheduled_at, now());
    LOOP
      next_at := next_at + step;
      EXIT WHEN next_at > now();
    END LOOP;
  ELSE
    next_at := NULL;  -- next_actions clones carry no schedule
  END IF;

  INSERT INTO tasks (user_id, project_id, title, status, scheduled_at, contexts, recurrence_rule)
  VALUES (NEW.user_id, NEW.project_id, NEW.title, OLD.status, next_at, NEW.contexts, NEW.recurrence_rule);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tasks_recurring_done ON tasks;
CREATE TRIGGER tasks_recurring_done
  AFTER UPDATE OF status ON tasks
  FOR EACH ROW
  WHEN (NEW.status = 'done'
        AND OLD.status IS DISTINCT FROM NEW.status
        AND OLD.status IN ('calendar', 'next_actions')
        AND NEW.recurrence_rule IS NOT NULL)
  EXECUTE FUNCTION handle_recurring_task_done();

CREATE OR REPLACE FUNCTION get_analytics(
  p_user_id uuid,
  p_from    timestamptz
)
RETURNS jsonb
LANGUAGE sql
STABLE
AS $$
  SELECT jsonb_build_object(
    'completed_by_day',
    COALESCE(
      (
        SELECT jsonb_agg(jsonb_build_object('day', day, 'count', cnt) ORDER BY day)
        FROM (
          SELECT (completed_at AT TIME ZONE 'UTC')::date::text AS day,
                 COUNT(*)::int AS cnt
          FROM   tasks
          WHERE  user_id      = p_user_id
            AND  status       = 'done'
            AND  completed_at >= p_from
          GROUP BY 1
        ) sub
      ),
      '[]'::jsonb
    ),
    'avg_cycle_days',
    (
      SELECT ROUND(AVG(EXTRACT(EPOCH FROM (completed_at - created_at)) / 86400.0))::int
      FROM   tasks
      WHERE  user_id      = p_user_id
        AND  status       = 'done'
        AND  completed_at >= p_from
        AND  completed_at IS NOT NULL
    ),
    'tasks_captured',
    (
      SELECT COUNT(*)::int
      FROM   tasks
      WHERE  user_id    = p_user_id
        AND  created_at >= p_from
    ),
    'status_counts',
    COALESCE(
      (
        SELECT jsonb_object_agg(status::text, cnt)
        FROM (
          SELECT status, COUNT(*)::int AS cnt
          FROM   tasks
          WHERE  user_id = p_user_id
          GROUP BY status
        ) sub
      ),
      '{}'::jsonb
    )
  );
$$;

-- ────────────────────────────────────────────────────────────
-- 4. INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_user_status     ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id      ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id      ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_id ON user_contexts(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
  ON tasks(user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 5. STORAGE
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('attachments', 'attachments', false, 10485760, NULL)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS
DO $$ BEGIN
    DROP POLICY IF EXISTS "Users can upload their own attachments" ON storage.objects;
    CREATE POLICY "Users can upload their own attachments" ON storage.objects
        FOR INSERT TO authenticated
        WITH CHECK (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

    DROP POLICY IF EXISTS "Users can read their own attachments" ON storage.objects;
    CREATE POLICY "Users can read their own attachments" ON storage.objects
        FOR SELECT TO authenticated
        USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);

    DROP POLICY IF EXISTS "Users can delete their own attachments" ON storage.objects;
    CREATE POLICY "Users can delete their own attachments" ON storage.objects
        FOR DELETE TO authenticated
        USING (bucket_id = 'attachments' AND (storage.foldername(name))[1] = auth.uid()::text);
END $$;

-- ────────────────────────────────────────────────────────────
-- 6. ROW LEVEL SECURITY (Hardened)
-- ────────────────────────────────────────────────────────────

ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects          ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contexts     ENABLE ROW LEVEL SECURITY;

-- TASKS
DROP POLICY IF EXISTS "tasks_select_own" ON tasks;
CREATE POLICY "tasks_select_own" ON tasks FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "tasks_insert_own" ON tasks;
CREATE POLICY "tasks_insert_own" ON tasks FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "tasks_update_own" ON tasks;
CREATE POLICY "tasks_update_own" ON tasks FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "tasks_delete_own" ON tasks;
CREATE POLICY "tasks_delete_own" ON tasks FOR DELETE USING (user_id = auth.uid());

-- PROJECTS
DROP POLICY IF EXISTS "projects_select_own" ON projects;
CREATE POLICY "projects_select_own" ON projects FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "projects_insert_own" ON projects;
CREATE POLICY "projects_insert_own" ON projects FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "projects_update_own" ON projects;
CREATE POLICY "projects_update_own" ON projects FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "projects_delete_own" ON projects;
CREATE POLICY "projects_delete_own" ON projects FOR DELETE USING (user_id = auth.uid());

-- USER INTEGRATIONS
DROP POLICY IF EXISTS "user_integrations_select_own" ON user_integrations;
CREATE POLICY "user_integrations_select_own" ON user_integrations FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_integrations_insert_own" ON user_integrations;
CREATE POLICY "user_integrations_insert_own" ON user_integrations FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_integrations_update_own" ON user_integrations;
CREATE POLICY "user_integrations_update_own" ON user_integrations FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_integrations_delete_own" ON user_integrations;
CREATE POLICY "user_integrations_delete_own" ON user_integrations FOR DELETE USING (user_id = auth.uid());

-- USER CONTEXTS
DROP POLICY IF EXISTS "user_contexts_select_own" ON user_contexts;
CREATE POLICY "user_contexts_select_own" ON user_contexts FOR SELECT USING (user_id = auth.uid());
DROP POLICY IF EXISTS "user_contexts_insert_own" ON user_contexts;
CREATE POLICY "user_contexts_insert_own" ON user_contexts FOR INSERT WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_contexts_update_own" ON user_contexts;
CREATE POLICY "user_contexts_update_own" ON user_contexts FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "user_contexts_delete_own" ON user_contexts;
CREATE POLICY "user_contexts_delete_own" ON user_contexts FOR DELETE USING (user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- 7. SECURITY REVOCATIONS
-- ────────────────────────────────────────────────────────────

REVOKE ALL ON user_integrations FROM anon;
REVOKE ALL ON user_integrations FROM public;

GRANT EXECUTE ON FUNCTION get_analytics(uuid, timestamptz) TO authenticated;

-- Explicit Data API privileges; row access remains controlled by RLS.
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.projects, public.tasks, public.user_integrations, public.user_contexts
TO authenticated, service_role;

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

-- Canonical migration for the SQL mitigation manually applied on production.
-- Preserves the production return type (json) and function body.
-- Do not replay migration 007 directly: it returns jsonb instead of json.
BEGIN;
ALTER FUNCTION public.get_analytics(uuid, timestamptz) SECURITY INVOKER;
ALTER FUNCTION public.get_analytics(uuid, timestamptz) SET search_path = public, pg_temp;
REVOKE ALL ON FUNCTION public.get_analytics(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_analytics(uuid, timestamptz) TO authenticated, service_role;
COMMIT;

-- Complete the snapshot with the remaining tables and security migrations.
ALTER TABLE public.user_integrations ADD COLUMN IF NOT EXISTS calendar_connected boolean NOT NULL DEFAULT false;

-- ============================================================
-- Migration 006 — Daily Reflections (Success Diary / Logbook)
-- ============================================================

CREATE TABLE daily_reflections (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date       date        NOT NULL,
  content    text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT daily_reflections_user_date_unique UNIQUE (user_id, date)
);

-- Index for the primary read path (fetch by user, ordered by date desc)
CREATE INDEX idx_daily_reflections_user_date
  ON daily_reflections (user_id, date DESC);

-- Auto-bump updated_at on every write (function may already exist from prior migrations)
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_daily_reflections_updated_at
  BEFORE UPDATE ON daily_reflections
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── RLS ───────────────────────────────────────────────────────

ALTER TABLE daily_reflections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "daily_reflections: select own"
  ON daily_reflections FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "daily_reflections: insert own"
  ON daily_reflections FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "daily_reflections: update own"
  ON daily_reflections FOR UPDATE
  USING (user_id = auth.uid());

-- Explicit Data API privileges; row access remains controlled by RLS.
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.daily_reflections
TO authenticated, service_role;

-- ============================================================
-- Migration 008 — Clarity Protocol (Anti-Worry Wizard)
-- Stores Willis Carrier formula sessions with a FK to the
-- resulting inbox task. Sessions are append-only (no UPDATE
-- policy); users may delete their own sensitive records.
-- ============================================================

CREATE TABLE clarity_sessions (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  worry_description    text        NOT NULL,
  worst_case_scenario  text        NOT NULL,
  resulting_task_id    uuid        REFERENCES tasks(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Primary read path: fetch by user, newest-first (for future history view)
CREATE INDEX idx_clarity_sessions_user
  ON clarity_sessions (user_id, created_at DESC);

-- ── RLS ────────────────────────────────────────────────────────

ALTER TABLE clarity_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clarity_sessions: select own"
  ON clarity_sessions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "clarity_sessions: insert own"
  ON clarity_sessions FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- No UPDATE policy — sessions are immutable records of a mental state.
-- DELETE is allowed because this is sensitive psychological data;
-- users hold an absolute right to erase their own records.
CREATE POLICY "clarity_sessions: delete own"
  ON clarity_sessions FOR DELETE
  USING (user_id = auth.uid());

-- Explicit Data API privileges; row access remains controlled by RLS.
GRANT SELECT, INSERT, UPDATE, DELETE
ON public.clarity_sessions
TO authenticated, service_role;

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

-- Requires SUPABASE_SERVICE_ROLE_KEY on the web server and matching web release.
-- Stage 1: run before deploying. Stage 2 removes legacy plaintext after deploy.
-- Supabase Vault keeps tokens encrypted on disk and in backups.
BEGIN;
CREATE SCHEMA IF NOT EXISTS vault;
CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;
ALTER TABLE public.user_integrations
  ADD COLUMN IF NOT EXISTS google_token_secret_id uuid,
  ADD COLUMN IF NOT EXISTS google_connected boolean NOT NULL DEFAULT false;

-- Serialize changes to a connection while moving its existing token.
DO $$
DECLARE connection record;
BEGIN
  FOR connection IN SELECT * FROM public.user_integrations
    WHERE google_refresh_token IS NOT NULL FOR UPDATE
  LOOP
    IF connection.google_token_secret_id IS NULL THEN
      UPDATE public.user_integrations SET
        google_token_secret_id = vault.create_secret(connection.google_refresh_token),
        google_connected = true
      WHERE id = connection.id;
    ELSE
      PERFORM vault.update_secret(connection.google_token_secret_id, connection.google_refresh_token);
      UPDATE public.user_integrations SET google_connected = true
      WHERE id = connection.id;
    END IF;
  END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_google_integration_secret(p_user_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT jsonb_build_object('google_refresh_token', s.decrypted_secret,
    'google_calendar_id', i.google_calendar_id)
  FROM public.user_integrations i
  LEFT JOIN vault.decrypted_secrets s ON s.id = i.google_token_secret_id
  WHERE i.user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION public.set_google_integration_secret(
  p_user_id uuid, p_refresh_token text, p_calendar_connected boolean
) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  IF p_refresh_token IS NULL OR length(p_refresh_token) NOT BETWEEN 1 AND 10000
    OR p_calendar_connected IS NULL THEN RAISE EXCEPTION 'Invalid integration'; END IF;
  INSERT INTO public.user_integrations(user_id) VALUES(p_user_id)
    ON CONFLICT(user_id) DO NOTHING;
  SELECT google_token_secret_id INTO secret_id FROM public.user_integrations
    WHERE user_id = p_user_id FOR UPDATE;
  IF secret_id IS NULL THEN
    secret_id := vault.create_secret(p_refresh_token);
  ELSE
    PERFORM vault.update_secret(secret_id, p_refresh_token);
  END IF;
  UPDATE public.user_integrations SET google_token_secret_id = secret_id,
    google_refresh_token = NULL, google_calendar_id = 'primary',
    google_connected = true, calendar_connected = p_calendar_connected
    WHERE user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.clear_google_integration_secret(p_user_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE secret_id uuid;
BEGIN
  SELECT google_token_secret_id INTO secret_id FROM public.user_integrations
    WHERE user_id = p_user_id FOR UPDATE;
  UPDATE public.user_integrations SET google_token_secret_id = NULL,
    google_refresh_token = NULL, google_calendar_id = NULL,
    google_connected = false, calendar_connected = false WHERE user_id = p_user_id;
  IF secret_id IS NOT NULL THEN DELETE FROM vault.secrets WHERE id = secret_id; END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_google_integration_secret()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  IF OLD.google_token_secret_id IS NOT NULL THEN
    DELETE FROM vault.secrets WHERE id = OLD.google_token_secret_id;
  END IF;
  RETURN OLD;
END;
$$;
DROP TRIGGER IF EXISTS cleanup_google_secret ON public.user_integrations;
CREATE TRIGGER cleanup_google_secret BEFORE DELETE ON public.user_integrations
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_google_integration_secret();

REVOKE ALL ON FUNCTION public.get_google_integration_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_google_integration_secret(uuid,text,boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.clear_google_integration_secret(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.cleanup_google_integration_secret() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_google_integration_secret(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_google_integration_secret(uuid,text,boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.clear_google_integration_secret(uuid) TO service_role;

-- Keep legacy code working during rollout without exposing or allowing writes
-- to the new Vault reference. Stage 2 removes these legacy token grants.
REVOKE ALL ON public.user_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,user_id,google_refresh_token,google_calendar_id,calendar_connected,google_connected,created_at)
  ON public.user_integrations TO authenticated;
GRANT INSERT (id,user_id,google_refresh_token,google_calendar_id,calendar_connected,created_at)
  ON public.user_integrations TO authenticated;
GRANT UPDATE (user_id,google_refresh_token,google_calendar_id,calendar_connected)
  ON public.user_integrations TO authenticated;
GRANT DELETE ON public.user_integrations TO authenticated;
COMMIT;

-- Stage 2: apply only after the matching web release is serving traffic.
BEGIN;
DO $$
DECLARE connection record;
BEGIN
  FOR connection IN SELECT * FROM public.user_integrations
    WHERE google_refresh_token IS NOT NULL FOR UPDATE
  LOOP
    IF connection.google_token_secret_id IS NULL THEN
      UPDATE public.user_integrations SET
        google_token_secret_id = vault.create_secret(connection.google_refresh_token),
        google_refresh_token = NULL, google_connected = true
      WHERE id = connection.id;
    ELSE
      PERFORM vault.update_secret(connection.google_token_secret_id, connection.google_refresh_token);
      UPDATE public.user_integrations SET google_refresh_token = NULL, google_connected = true
      WHERE id = connection.id;
    END IF;
  END LOOP;
END;
$$;

-- RLS still limits the visible connection status to its owner.
-- Revoke column grants too, so a prior explicit grant cannot survive.
REVOKE ALL ON public.user_integrations FROM PUBLIC, anon, authenticated;
REVOKE ALL (google_refresh_token, google_token_secret_id) ON public.user_integrations
  FROM PUBLIC, anon, authenticated;
GRANT SELECT (id,user_id,google_calendar_id,calendar_connected,google_connected,created_at)
  ON public.user_integrations TO authenticated;
COMMIT;

-- Match the existing UI limits at the database boundary as well as Server Actions.
-- All constraints are validated in this transaction. Legacy violations abort the
-- migration without rewriting or truncating user data.
BEGIN;
CREATE OR REPLACE FUNCTION public.valid_task_contexts(context_values text[])
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT context_values IS NOT NULL AND coalesce(array_ndims(context_values),1) = 1
    AND cardinality(context_values) <= 20
    AND NOT EXISTS (SELECT 1 FROM unnest(context_values) value WHERE value IS NULL OR length(value) > 50);
$$;
CREATE OR REPLACE FUNCTION public.valid_task_attachments(items jsonb, owner_id uuid)
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE item jsonb;
BEGIN
  IF jsonb_typeof(items) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  IF jsonb_array_length(items) > 20 THEN RETURN false; END IF;
  FOR item IN SELECT value FROM jsonb_array_elements(items) LOOP
    IF jsonb_typeof(item) IS DISTINCT FROM 'object'
      OR jsonb_typeof(item->'name') IS DISTINCT FROM 'string'
      OR length(item->>'name') NOT BETWEEN 1 AND 255
      OR jsonb_typeof(item->'path') IS DISTINCT FROM 'string'
      OR length(item->>'path') NOT BETWEEN 1 AND 1000
      OR left(item->>'path',37) <> owner_id::text || '/'
      OR jsonb_typeof(item->'type') IS DISTINCT FROM 'string'
      OR length(item->>'type') NOT BETWEEN 1 AND 100
      OR jsonb_typeof(item->'size') IS DISTINCT FROM 'number'
    THEN RETURN false; END IF;
    IF (item->>'size')::numeric NOT BETWEEN 0 AND 10485760
      OR trunc((item->>'size')::numeric) <> (item->>'size')::numeric THEN RETURN false; END IF;
  END LOOP;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.valid_task_contexts(text[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.valid_task_attachments(jsonb,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.valid_task_contexts(text[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.valid_task_attachments(jsonb,uuid) TO authenticated, service_role;

DO $$
DECLARE rule record;
BEGIN
  FOR rule IN SELECT * FROM (VALUES
    ('tasks','tasks_title_bounds','length(title) BETWEEN 1 AND 500'),
    ('tasks','tasks_context_bounds','public.valid_task_contexts(contexts)'),
    ('tasks','tasks_attachment_bounds','public.valid_task_attachments(attachments,user_id)'),
    ('tasks','tasks_delegate_bounds','delegated_to IS NULL OR length(delegated_to) <= 200'),
    ('projects','projects_title_bounds','length(title) BETWEEN 1 AND 500'),
    ('projects','projects_criteria_bounds','length(completion_criteria) <= 1000'),
    ('projects','projects_plan_bounds', 'CASE WHEN jsonb_typeof(rough_plan) = ''array'' THEN jsonb_array_length(rough_plan) <= 100 AND octet_length(rough_plan::text) <= 200000 ELSE false END'),
    ('user_contexts','user_contexts_name_bounds','length(name) BETWEEN 1 AND 50'),
    ('daily_reflections','daily_reflections_content_bounds','length(content) <= 5000'),
    ('clarity_sessions','clarity_worry_bounds','length(worry_description) BETWEEN 1 AND 2000'),
    ('clarity_sessions','clarity_worst_case_bounds','length(worst_case_scenario) BETWEEN 1 AND 2000')
  ) AS rules(table_name,constraint_name,expression)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = rule.constraint_name
      AND conrelid = format('public.%I',rule.table_name)::regclass) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s) NOT VALID',rule.table_name,rule.constraint_name,rule.expression);
    END IF;
    EXECUTE format('ALTER TABLE public.%I VALIDATE CONSTRAINT %I',rule.table_name,rule.constraint_name);
  END LOOP;
END;
$$;
COMMIT;

-- Remaining public RPCs used by the application.
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

-- Apply before deploying the matching web actions. All functions retain RLS.
-- No data rewrite; failed calls roll back all their writes.
BEGIN;

CREATE OR REPLACE FUNCTION public.create_project_from_inbox(
  p_origin_task_id uuid, p_title text, p_completion_criteria text,
  p_rough_plan_lines text[], p_first_step_title text
) RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  origin public.tasks;
  project public.projects;
  plan jsonb;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_title IS NULL OR length(btrim(p_title)) NOT BETWEEN 1 AND 500
    OR p_completion_criteria IS NULL OR length(p_completion_criteria) > 1000
    OR p_first_step_title IS NULL OR length(p_first_step_title) > 500
    OR p_rough_plan_lines IS NULL OR cardinality(p_rough_plan_lines) > 50
    OR EXISTS (SELECT 1 FROM unnest(p_rough_plan_lines) line WHERE line IS NULL OR length(line) > 500)
  THEN RAISE EXCEPTION 'Invalid project input' USING ERRCODE = '22023'; END IF;

  SELECT * INTO origin FROM public.tasks
    WHERE id = p_origin_task_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Inbox task not found'; END IF;
  -- A retry of the same conversion returns the previously created project.
  IF origin.project_id IS NOT NULL THEN
    SELECT * INTO project FROM public.projects WHERE id = origin.project_id AND user_id = owner_id;
    IF FOUND THEN RETURN jsonb_build_object('project', to_jsonb(project), 'firstTask', to_jsonb(origin)); END IF;
  END IF;
  IF origin.status <> 'inbox' OR origin.project_id IS NOT NULL THEN
    RAISE EXCEPTION 'Task has already been processed';
  END IF;

  SELECT coalesce(jsonb_agg(jsonb_build_object('id', gen_random_uuid(), 'text', text, 'order', position - 1)
    ORDER BY position), '[]'::jsonb) INTO plan
  FROM (SELECT btrim(line) AS text, row_number() OVER (ORDER BY ordinal) AS position
    FROM unnest(p_rough_plan_lines) WITH ORDINALITY AS lines(line, ordinal)
    WHERE btrim(line) <> '') steps;

  INSERT INTO public.projects(user_id, title, completion_criteria, rough_plan)
    VALUES(owner_id, btrim(p_title), btrim(p_completion_criteria), plan) RETURNING * INTO project;
  UPDATE public.tasks SET title = coalesce(nullif(btrim(p_first_step_title), ''), btrim(p_title)),
    status = 'next_actions', project_id = project.id
    WHERE id = origin.id AND user_id = owner_id RETURNING * INTO origin;
  UPDATE public.projects SET first_step_task_id = origin.id
    WHERE id = project.id AND user_id = owner_id RETURNING * INTO project;
  RETURN jsonb_build_object('project', to_jsonb(project), 'firstTask', to_jsonb(origin));
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_project_step(p_project_id uuid, p_item_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
  task public.tasks;
  item jsonb;
  plan jsonb;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO project FROM public.projects
    WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  -- Reuse the plan item's UUID as task ID for idempotent retries.
  SELECT * INTO task FROM public.tasks WHERE id = p_item_id AND project_id = p_project_id AND user_id = owner_id;
  IF FOUND THEN RETURN to_jsonb(task); END IF;
  IF project.status <> 'active' THEN RAISE EXCEPTION 'Project is completed'; END IF;
  IF EXISTS (SELECT 1 FROM public.tasks WHERE project_id = p_project_id AND user_id = owner_id
    AND status IN ('next_actions', 'waiting_for', 'calendar'))
  THEN RAISE EXCEPTION 'Review the active step before promoting another'; END IF;
  SELECT value INTO item FROM jsonb_array_elements(project.rough_plan) WHERE value->>'id' = p_item_id::text;
  IF item IS NULL THEN RAISE EXCEPTION 'Plan item not found'; END IF;
  IF length(btrim(item->>'text')) NOT BETWEEN 1 AND 500 THEN RAISE EXCEPTION 'Invalid plan item'; END IF;
  SELECT coalesce(jsonb_agg(value ORDER BY ordinal), '[]'::jsonb) INTO plan
    FROM jsonb_array_elements(project.rough_plan) WITH ORDINALITY AS items(value, ordinal)
    WHERE value->>'id' <> p_item_id::text;
  INSERT INTO public.tasks(id, user_id, project_id, title, status)
    VALUES(p_item_id, owner_id, p_project_id, btrim(item->>'text'), 'next_actions') RETURNING * INTO task;
  UPDATE public.projects SET rough_plan = plan, first_step_task_id = task.id
    WHERE id = p_project_id AND user_id = owner_id;
  RETURN to_jsonb(task);
END;
$$;

CREATE OR REPLACE FUNCTION public.reorder_project_plan(p_project_id uuid, p_ordered_ids uuid[])
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
  plan jsonb;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_ordered_ids IS NULL OR cardinality(p_ordered_ids) > 100
    OR EXISTS (SELECT 1 FROM unnest(p_ordered_ids) id WHERE id IS NULL)
    OR cardinality(p_ordered_ids) <> (SELECT count(DISTINCT id) FROM unnest(p_ordered_ids) id)
  THEN RAISE EXCEPTION 'Invalid step order' USING ERRCODE = '22023'; END IF;
  SELECT * INTO project FROM public.projects WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF project.status <> 'active' THEN RAISE EXCEPTION 'Project is completed'; END IF;
  -- Read the latest plan under its row lock. Omitted/new items survive, promoted items stay removed.
  SELECT coalesce(jsonb_agg(value || jsonb_build_object('order', position - 1) ORDER BY position), '[]'::jsonb)
    INTO plan FROM (
      SELECT value, row_number() OVER (ORDER BY array_position(p_ordered_ids, (value->>'id')::uuid) NULLS LAST, ordinal) AS position
      FROM jsonb_array_elements(project.rough_plan) WITH ORDINALITY AS items(value, ordinal)
    ) ordered;
  UPDATE public.projects SET rough_plan = plan WHERE id = p_project_id AND user_id = owner_id;
  RETURN plan;
END;
$$;

CREATE OR REPLACE FUNCTION public.add_project_plan_step(p_project_id uuid, p_item_id uuid, p_text text)
RETURNS jsonb LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
  item jsonb;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  IF p_item_id IS NULL OR p_text IS NULL OR length(btrim(p_text)) NOT BETWEEN 1 AND 500
    THEN RAISE EXCEPTION 'Invalid step' USING ERRCODE = '22023'; END IF;
  SELECT * INTO project FROM public.projects WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF project.status <> 'active' THEN RAISE EXCEPTION 'Project is completed'; END IF;
  SELECT value INTO item FROM jsonb_array_elements(project.rough_plan) WHERE value->>'id' = p_item_id::text;
  IF item IS NOT NULL THEN RETURN item; END IF;
  -- Do not resurrect a plan item whose promotion already committed.
  IF EXISTS (SELECT 1 FROM public.tasks WHERE id = p_item_id AND project_id = p_project_id AND user_id = owner_id)
    THEN RAISE EXCEPTION 'Step has already been promoted'; END IF;
  IF jsonb_array_length(project.rough_plan) >= 100 THEN RAISE EXCEPTION 'Plan has reached 100 steps'; END IF;
  item := jsonb_build_object('id', p_item_id, 'text', btrim(p_text), 'order', jsonb_array_length(project.rough_plan));
  UPDATE public.projects SET rough_plan = rough_plan || jsonb_build_array(item)
    WHERE id = p_project_id AND user_id = owner_id;
  RETURN item;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_project_step(p_project_id uuid, p_task_id uuid)
-- The existing recurrence trigger resolves its INSERT through public.
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = public, pg_temp AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
  task public.tasks;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO project FROM public.projects WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  SELECT * INTO task FROM public.tasks
    WHERE id = p_task_id AND project_id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project step not found'; END IF;
  IF task.status = 'done' THEN RETURN; END IF;
  IF project.status <> 'active' OR task.status <> 'next_actions' THEN RAISE EXCEPTION 'Step is not a next action'; END IF;
  UPDATE public.tasks SET status = 'done', completed_at = now() WHERE id = p_task_id AND user_id = owner_id;
  UPDATE public.projects SET first_step_task_id = NULL
    WHERE id = p_project_id AND user_id = owner_id AND first_step_task_id = p_task_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_project(p_project_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE
  owner_id uuid := auth.uid();
  project public.projects;
BEGIN
  IF owner_id IS NULL THEN RAISE EXCEPTION 'Unauthorized' USING ERRCODE = '42501'; END IF;
  SELECT * INTO project FROM public.projects WHERE id = p_project_id AND user_id = owner_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Project not found'; END IF;
  IF project.status = 'completed' THEN RETURN; END IF;
  IF jsonb_array_length(project.rough_plan) > 0 OR EXISTS (
    SELECT 1 FROM public.tasks WHERE project_id = p_project_id AND user_id = owner_id
      AND status IN ('inbox', 'next_actions', 'waiting_for', 'calendar')
  ) THEN RAISE EXCEPTION 'Project still has unfinished steps'; END IF;
  UPDATE public.projects SET status = 'completed', first_step_task_id = NULL WHERE id = p_project_id AND user_id = owner_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_project_from_inbox(uuid, text, text, text[], text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.promote_project_step(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.reorder_project_plan(uuid, uuid[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_project_plan_step(uuid, uuid, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_project_step(uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.complete_project(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_project_from_inbox(uuid, text, text, text[], text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.promote_project_step(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.reorder_project_plan(uuid, uuid[]) TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_project_plan_step(uuid, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_project_step(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_project(uuid) TO authenticated;
COMMIT;
