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
