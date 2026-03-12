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
