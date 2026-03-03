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
    updated_at                  timestamptz NOT NULL DEFAULT now()
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

-- ────────────────────────────────────────────────────────────
-- 4. INDEXES
-- ────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_user_status   ON tasks(user_id, status);
CREATE INDEX IF NOT EXISTS idx_tasks_project_id    ON tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_projects_user_id    ON projects(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contexts_user_id ON user_contexts(user_id);

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
