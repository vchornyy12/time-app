-- ============================================================
-- Migration 005 — Add completed_at to tasks
-- ============================================================

-- 1. Add the column (nullable; existing rows remain null)
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- 2. Index for analytics queries (filter + order by completed_at)
CREATE INDEX IF NOT EXISTS idx_tasks_completed_at
  ON tasks(user_id, completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- 3. Trigger function: auto-set completed_at when status → 'done',
--    clear it if a task is moved out of 'done'.
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

-- 4. Attach trigger (fires before each UPDATE on tasks)
DROP TRIGGER IF EXISTS trigger_completed_at ON tasks;

CREATE TRIGGER trigger_completed_at
  BEFORE UPDATE ON tasks
  FOR EACH ROW EXECUTE FUNCTION set_completed_at();
