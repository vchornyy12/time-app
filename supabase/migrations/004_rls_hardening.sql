-- ============================================================
-- GTD App — RLS Hardening Migration
-- Replaces broad FOR ALL policies with per-operation policies
-- for stricter, auditable Row Level Security.
-- ============================================================
-- This migration is IDEMPOTENT: it drops old policies first,
-- then re-creates per-operation policies for every table.
-- ────────────────────────────────────────────────────────────

-- ============================================================
-- 1 ▸ TASKS
-- ============================================================

-- Ensure RLS is enabled (no-op if already on)
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

-- Drop the broad policy
DROP POLICY IF EXISTS "tasks: own rows only" ON tasks;

-- Per-operation policies
CREATE POLICY "tasks_select_own" ON tasks
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "tasks_insert_own" ON tasks
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "tasks_update_own" ON tasks
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "tasks_delete_own" ON tasks
  FOR DELETE USING (user_id = auth.uid());


-- ============================================================
-- 2 ▸ PROJECTS
-- ============================================================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "projects: own rows only" ON projects;

CREATE POLICY "projects_select_own" ON projects
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "projects_insert_own" ON projects
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_update_own" ON projects
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "projects_delete_own" ON projects
  FOR DELETE USING (user_id = auth.uid());


-- ============================================================
-- 3 ▸ USER_INTEGRATIONS
-- ============================================================

ALTER TABLE user_integrations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "integrations: own row only" ON user_integrations;

CREATE POLICY "user_integrations_select_own" ON user_integrations
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_integrations_insert_own" ON user_integrations
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_integrations_update_own" ON user_integrations
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_integrations_delete_own" ON user_integrations
  FOR DELETE USING (user_id = auth.uid());


-- ============================================================
-- 4 ▸ USER_CONTEXTS
-- ============================================================

ALTER TABLE user_contexts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_contexts: own rows only" ON user_contexts;

CREATE POLICY "user_contexts_select_own" ON user_contexts
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "user_contexts_insert_own" ON user_contexts
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_contexts_update_own" ON user_contexts
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "user_contexts_delete_own" ON user_contexts
  FOR DELETE USING (user_id = auth.uid());


-- ============================================================
-- 5 ▸ FORCE-DENY PUBLIC / ANON FOR SENSITIVE TABLES
-- ============================================================
-- Revoke default access from the anon role on integration data.
-- The anon key should never be able to read tokens even
-- if someone bypasses the frontend.

REVOKE ALL ON user_integrations FROM anon;
REVOKE ALL ON user_integrations FROM public;
