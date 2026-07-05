-- Recurrence v1: constrain recurrence_rule to the four presets and
-- regenerate the next occurrence when a recurring task is completed.
-- Spec: docs/superpowers/specs/2026-07-03-task-recurrence-design.md

-- Normalize any stray values written during manual testing, then constrain.
UPDATE tasks
SET recurrence_rule = NULL
WHERE recurrence_rule IS NOT NULL
  AND recurrence_rule NOT IN ('daily', 'weekly', 'monthly', 'yearly');

DO $$ BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'tasks_recurrence_rule_check'
    ) THEN
        ALTER TABLE tasks
            ADD CONSTRAINT tasks_recurrence_rule_check
            CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily', 'weekly', 'monthly', 'yearly'));
    END IF;
END $$;

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
