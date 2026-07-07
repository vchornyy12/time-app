# Task Recurrence — Design

**Date:** 2026-07-03
**Status:** Approved
**Origin:** Deep-review finding CR-HOLISTIC-COH-01-001 (CR-20260703-200624): `recurrence_rule` was display-only — the mobile app showed a repeat icon, but no code path could set the column and completion never generated a next occurrence.

## Goal

Make recurrence real: users can mark a task as repeating while processing it, and completing a recurring task automatically creates the next occurrence — regardless of which client (web or mobile) performed the completion.

## Decisions

| Question | Decision |
|----------|----------|
| Rule format | Simple presets: `daily`, `weekly`, `monthly`, `yearly` (stored as plain keywords in `tasks.recurrence_rule text`; upgradeable to RRULE later) |
| Write path (v1) | Web processing flow only; mobile stays read-only (icon display already exists) |
| Completion semantics | Immediate reappear: the next occurrence is created in the same transaction as completion |
| Regeneration location | Postgres `AFTER UPDATE` trigger — one implementation covers web `markTaskDone`, web `processAsDone`, weekly-review completions, mobile's direct Supabase update, and any future client |

## Data Model

- `tasks.recurrence_rule text` — unchanged type. Allowed values: `'daily' | 'weekly' | 'monthly' | 'yearly' | NULL` (NULL = not recurring).
- New migration `supabase/migrations/20260703000000_recurrence_trigger.sql`:
  - `CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily','weekly','monthly','yearly'))` on `tasks`.
  - Trigger function + trigger (below).
- `supabase/full_schema.sql` updated to match (constraint, function, trigger).

## Regeneration Trigger

Function `handle_recurring_task_done()` with trigger:

```
AFTER UPDATE OF status ON tasks
FOR EACH ROW
WHEN (NEW.status = 'done'
      AND OLD.status IS DISTINCT FROM 'done'
      AND NEW.recurrence_rule IS NOT NULL
      AND OLD.status IN ('calendar', 'next_actions'))
```

The function inserts one new row (the next occurrence):

**Copied:** `user_id`, `project_id`, `title`, `contexts`, `recurrence_rule`. `status` = `OLD.status` (calendar task recurs as calendar, next action as next action).

**scheduled_at (calendar tasks only):** `OLD.scheduled_at` + interval (`1 day` / `7 days` / `1 month` / `1 year`), rolled forward in a loop until strictly in the future. Preserves time of day; completing a daily task 3 days late schedules the next occurrence tomorrow, not in the past. Postgres interval arithmetic handles month-end clamping (Jan 31 + 1 month = Feb 28). If `OLD.scheduled_at` is NULL (defensive), fall back to `now()` + interval. Next-action clones get `scheduled_at = NULL`.

**Not copied (fresh occurrence starts clean):** `completed_at`, `google_calendar_event_id`, `attachments` (defaults to `[]`), `delegated_to`, `is_delegation_communicated` (default false), `due_date`. `created_at`/`updated_at` take their defaults.

**Safety properties:**
- Fires on UPDATE, performs INSERT → no trigger recursion.
- Runs without `SECURITY DEFINER`; the inserted row keeps the same `user_id` as the completing user, so the existing RLS insert policy (`auth.uid() = user_id`) passes.
- Same transaction as the completion update: if the insert fails, the completion rolls back (no silent loss of a recurring task).

## Web Write Path

- `lib/validation/schemas.ts`: new primitive `recurrenceRule = z.enum(['daily','weekly','monthly','yearly']).nullable()`; added as optional field (default `null`) to `processToCalendarSchema` and `processToNextActionsSchema`.
- `lib/actions/processing.ts`: `processToCalendar(taskId, scheduledAt, recurrenceRule?)` and `processToNextActions(...)` persist `recurrence_rule`.
- `components/tasks/ProcessingOverlay.tsx`: "Repeat" select — options None (default) / Daily / Weekly / Monthly / Yearly — on:
  - **step4b** (calendar datetime picker)
  - **step6b** (next-action clarification + contexts)
- `lib/types/index.ts`: `recurrence_rule: 'daily' | 'weekly' | 'monthly' | 'yearly' | null`.

## Display

- Web: repeat icon (lucide `Repeat`) on task rows with a non-null `recurrence_rule` in `components/tasks/TaskList.tsx` and `components/tasks/CalendarList.tsx`, styled consistently with existing row metadata.
- Mobile: no changes — `TaskRow` already renders the repeat icon from `recurrence_rule`.

## Accepted v1 Limitations

1. Recurring next actions reappear immediately on completion (chosen semantics; no defer/activation date).
2. Trigger-created calendar occurrences have no Google Calendar event (`google_calendar_event_id` is NULL → shown as unsynced). GCal sync for regenerated occurrences is a future enhancement.
3. Recurrence can only be set during inbox processing; editing/removing it on an existing task is out of scope.
4. Attachments are not carried to the next occurrence.
5. Recurrence does not survive lifecycle transitions out of `calendar`/`next_actions`: delegating, moving to inbox/someday/notes/trash, or reprocessing keeps (or later resurrects) the stored rule but only completion from `calendar`/`next_actions` regenerates. Clearing `recurrence_rule` on those transitions is a planned fast-follow.

## Testing

- **Vitest** (`lib/actions/processing.validation.test.ts` pattern): `recurrenceRule` accepts the four presets and null, rejects other strings; both processing schemas parse with/without the field.
- **Playwright E2E** (`tests/e2e/`): 
  - Process an inbox item to Next Actions with Repeat=Daily → complete it from Next Actions → assert a fresh uncompleted copy appears.
  - Process to Calendar with Repeat=Daily → complete → assert a new occurrence exists with advanced date (exercises the trigger against the real database).
- Implementation follows TDD (superpowers:test-driven-development).

## Out of Scope

- RRULE/interval expressiveness ("every 2 weeks on Monday").
- Mobile write path.
- Deferred reappearance ("activates_at") and any scheduler/cron.
- GCal event creation for regenerated occurrences.
- Recurrence editing UI on existing tasks.
