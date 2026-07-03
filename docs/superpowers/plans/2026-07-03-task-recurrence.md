# Task Recurrence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `tasks.recurrence_rule` functional: users set a repeat preset (daily/weekly/monthly/yearly) while processing an inbox item to Calendar or Next Actions, and completing a recurring task automatically creates the next occurrence via a Postgres trigger — regardless of which client completed it.

**Architecture:** A Postgres `AFTER UPDATE` trigger on `tasks` clones the row when a recurring task transitions to `done` (single implementation covering web server actions AND the mobile app's direct Supabase updates). The web write path threads an optional `recurrenceRule` through Zod schemas → `processToCalendar`/`processToNextActions` server actions → a new `RepeatPicker` select in `ProcessingOverlay`. Web task rows get a repeat icon; mobile already displays one and needs no changes.

**Tech Stack:** Next.js 16 App Router, React 19, Zod 4, Supabase (Postgres + RLS), Vitest + Testing Library (jsdom), Playwright.

**Spec:** `docs/superpowers/specs/2026-07-03-task-recurrence-design.md`

## Global Constraints

- Allowed rule values, exactly: `'daily' | 'weekly' | 'monthly' | 'yearly'` or `NULL` (never empty string in the DB).
- No new npm dependencies. `lucide-react` (web) already provides the `Repeat` icon.
- All web commands run from the repo root. Unit tests: `npx vitest run <file>`. E2E: `npx playwright test <file>`.
- E2E task titles MUST start with `E2E` — global-setup deletes `E2E%` tasks between runs (this is how recurring clones get cleaned up).
- Migration applies to the linked Supabase project via the Supabase MCP `apply_migration` tool (permission already granted in this repo). `supabase/full_schema.sql` must be kept in sync with every migration.
- Trigger regenerates ONLY when the previous status was `calendar` or `next_actions` (spec: other statuses never carry recurrence).
- Commit after every task; use conventional commit prefixes (`feat:`, `test:`, `feat(db):`).

---

### Task 1: Database — CHECK constraint, trigger function, trigger

**Files:**
- Create: `supabase/migrations/20260703000000_recurrence_trigger.sql`
- Modify: `supabase/full_schema.sql` (tasks table ~line 69; FUNCTIONS & TRIGGERS section ~line 104)

**Interfaces:**
- Consumes: existing `tasks` table with `recurrence_rule text` column (migration `20260527000000`), `task_status` enum.
- Produces: DB guarantee used by all later tasks — updating a task to `status='done'` whose `recurrence_rule` is set and whose previous status was `calendar`/`next_actions` inserts a clone (same `user_id`, `project_id`, `title`, `contexts`, `recurrence_rule`; status = previous status; `scheduled_at` advanced for calendar clones, NULL otherwise).

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/20260703000000_recurrence_trigger.sql`:

```sql
-- Recurrence v1: constrain recurrence_rule to the four presets and
-- regenerate the next occurrence when a recurring task is completed.
-- Spec: docs/superpowers/specs/2026-07-03-task-recurrence-design.md

-- Normalize any stray values written during manual testing, then constrain.
UPDATE tasks
SET recurrence_rule = NULL
WHERE recurrence_rule IS NOT NULL
  AND recurrence_rule NOT IN ('daily', 'weekly', 'monthly', 'yearly');

ALTER TABLE tasks
  ADD CONSTRAINT tasks_recurrence_rule_check
  CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily', 'weekly', 'monthly', 'yearly'));

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
```

- [ ] **Step 2: Mirror into full_schema.sql**

In `supabase/full_schema.sql`, change the tasks-table column line (~line 69):

```sql
    recurrence_rule             text CHECK (recurrence_rule IS NULL OR recurrence_rule IN ('daily', 'weekly', 'monthly', 'yearly'))
```

And append to the `3. FUNCTIONS & TRIGGERS` section (after the `trigger_completed_at` trigger, ~line 140) the exact same `CREATE OR REPLACE FUNCTION handle_recurring_task_done()` + `DROP TRIGGER IF EXISTS` + `CREATE TRIGGER tasks_recurring_done` block from Step 1 (copy it verbatim, without the UPDATE/ALTER statements — the inline CHECK replaces the ALTER).

- [ ] **Step 3: Apply the migration**

Apply via the Supabase MCP tool `apply_migration` with name `recurrence_trigger` and the file's content. (Fallback if MCP is unavailable: `npx supabase db push` from repo root, or paste into the Supabase SQL editor.)

Expected: success, no errors. If the ALTER fails with "constraint ... already exists", the migration was already applied — verify with Step 4 and continue.

- [ ] **Step 4: Behavioral verification — calendar recurrence**

Run via Supabase MCP `execute_sql`:

```sql
INSERT INTO tasks (user_id, title, status, scheduled_at, recurrence_rule)
SELECT id, '__trigger_test__', 'calendar', now() - interval '3 days', 'daily'
FROM auth.users LIMIT 1;

UPDATE tasks SET status = 'done'
WHERE title = '__trigger_test__' AND status = 'calendar';

SELECT status, recurrence_rule, scheduled_at > now() AS in_future
FROM tasks WHERE title = '__trigger_test__' ORDER BY created_at;
```

Expected: exactly 2 rows — `(done, daily, false)` and `(calendar, daily, true)`. The clone's `scheduled_at` must be in the future (rolled forward past the 3-day lateness).

- [ ] **Step 5: Behavioral verification — next_actions recurrence + non-recurring control**

Run via `execute_sql`:

```sql
INSERT INTO tasks (user_id, title, status, recurrence_rule)
SELECT id, '__trigger_test_na__', 'next_actions', 'weekly'
FROM auth.users LIMIT 1;

UPDATE tasks SET status = 'done'
WHERE title = '__trigger_test_na__' AND status = 'next_actions';

SELECT status, scheduled_at FROM tasks
WHERE title = '__trigger_test_na__' ORDER BY created_at;

-- control: non-recurring task must NOT clone
INSERT INTO tasks (user_id, title, status)
SELECT id, '__trigger_test_ctl__', 'next_actions'
FROM auth.users LIMIT 1;

UPDATE tasks SET status = 'done' WHERE title = '__trigger_test_ctl__';

SELECT count(*) AS ctl_count FROM tasks WHERE title = '__trigger_test_ctl__';
```

Expected: `__trigger_test_na__` returns 2 rows — `(done, NULL)` and `(next_actions, NULL)`. `ctl_count` = 1 (no clone).

- [ ] **Step 6: Verify the CHECK constraint rejects bad values**

Run via `execute_sql` (expected to ERROR — that is the pass condition):

```sql
UPDATE tasks SET recurrence_rule = 'fortnightly' WHERE title = '__trigger_test__';
```

Expected: error containing `tasks_recurrence_rule_check`.

- [ ] **Step 7: Clean up test rows**

```sql
DELETE FROM tasks WHERE title LIKE '__trigger_test%';
```

Expected: 5 rows deleted (2 + 2 + 1).

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/20260703000000_recurrence_trigger.sql supabase/full_schema.sql
git commit -m "feat(db): regenerate recurring tasks on completion via trigger"
```

---

### Task 2: Types + Zod validation (TDD)

**Files:**
- Modify: `lib/types/index.ts:42` (Task.recurrence_rule)
- Modify: `lib/validation/schemas.ts` (new primitive + 2 schema fields)
- Test: `lib/actions/processing.validation.test.ts` (append describes)

**Interfaces:**
- Consumes: nothing new.
- Produces (later tasks import these exact names):
  - `lib/types/index.ts`: `export const RECURRENCE_RULES = ['daily', 'weekly', 'monthly', 'yearly'] as const` and `export type RecurrenceRule = (typeof RECURRENCE_RULES)[number]`; `Task.recurrence_rule: RecurrenceRule | null`.
  - `lib/validation/schemas.ts`: `export const recurrenceRule = z.enum(RECURRENCE_RULES)`; `processToCalendarSchema` and `processToNextActionsSchema` each gain `recurrenceRule: recurrenceRule.nullable().default(null)` — parsed output always has `recurrenceRule` (null when omitted).

- [ ] **Step 1: Write the failing tests**

Append to `lib/actions/processing.validation.test.ts`:

```ts
// ── recurrenceRule (Recurrence v1) ────────────────────────────

describe('processToCalendar recurrenceRule validation', () => {
  it('defaults recurrenceRule to null when omitted', () => {
    const result = processToCalendarSchema.parse({
      taskId: VALID_UUID,
      scheduledAt: '2026-07-04T09:00:00Z',
    })
    expect(result.recurrenceRule).toBeNull()
  })

  it.each(['daily', 'weekly', 'monthly', 'yearly'] as const)('accepts %s', (rule) => {
    const result = processToCalendarSchema.parse({
      taskId: VALID_UUID,
      scheduledAt: '2026-07-04T09:00:00Z',
      recurrenceRule: rule,
    })
    expect(result.recurrenceRule).toBe(rule)
  })

  it('accepts explicit null', () => {
    const result = processToCalendarSchema.parse({
      taskId: VALID_UUID,
      scheduledAt: '2026-07-04T09:00:00Z',
      recurrenceRule: null,
    })
    expect(result.recurrenceRule).toBeNull()
  })

  it('rejects unknown rule strings', () => {
    expect(() =>
      processToCalendarSchema.parse({
        taskId: VALID_UUID,
        scheduledAt: '2026-07-04T09:00:00Z',
        recurrenceRule: 'fortnightly',
      })
    ).toThrow()
  })

  it('rejects empty string (must be null, never "")', () => {
    expect(() =>
      processToCalendarSchema.parse({
        taskId: VALID_UUID,
        scheduledAt: '2026-07-04T09:00:00Z',
        recurrenceRule: '',
      })
    ).toThrow()
  })
})

describe('processToNextActions recurrenceRule validation', () => {
  it('defaults recurrenceRule to null when omitted', () => {
    const result = processToNextActionsSchema.parse({ taskId: VALID_UUID })
    expect(result.recurrenceRule).toBeNull()
  })

  it('accepts a valid rule alongside contexts', () => {
    const result = processToNextActionsSchema.parse({
      taskId: VALID_UUID,
      contexts: ['@home'],
      recurrenceRule: 'weekly',
    })
    expect(result.recurrenceRule).toBe('weekly')
    expect(result.contexts).toEqual(['@home'])
  })

  it('rejects unknown rule strings', () => {
    expect(() =>
      processToNextActionsSchema.parse({ taskId: VALID_UUID, recurrenceRule: 'hourly' })
    ).toThrow()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run lib/actions/processing.validation.test.ts`
Expected: the new describes FAIL (`recurrenceRule` is stripped by Zod, so `result.recurrenceRule` is `undefined`, not `null`; unknown-string cases pass-through without throwing). Pre-existing tests still PASS.

- [ ] **Step 3: Implement types**

In `lib/types/index.ts`, above the `Task` interface add:

```ts
export const RECURRENCE_RULES = ['daily', 'weekly', 'monthly', 'yearly'] as const
export type RecurrenceRule = (typeof RECURRENCE_RULES)[number]
```

and change line 42 from `recurrence_rule: string | null` to:

```ts
  recurrence_rule: RecurrenceRule | null
```

- [ ] **Step 4: Implement schemas**

In `lib/validation/schemas.ts`:

Add to imports (top of file):

```ts
import { RECURRENCE_RULES } from '@/lib/types'
```

Add to the Primitives section:

```ts
export const recurrenceRule = z.enum(RECURRENCE_RULES)
```

Extend the two schemas:

```ts
export const processToCalendarSchema = z.object({
  taskId,
  scheduledAt: datetimeString,
  recurrenceRule: recurrenceRule.nullable().default(null),
})
```

```ts
export const processToNextActionsSchema = z.object({
  taskId,
  contexts: contexts.default([]),
  nextActionTitle: optionalTitle,
  recurrenceRule: recurrenceRule.nullable().default(null),
})
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run lib/actions/processing.validation.test.ts`
Expected: ALL tests PASS (new and pre-existing).

- [ ] **Step 6: Run the full unit suite (type narrowing may ripple)**

Run: `npm run test:run`
Expected: PASS. If any test constructs a `Task` with an arbitrary `recurrence_rule` string, change that value to one of the four presets or `null`.

- [ ] **Step 7: Commit**

```bash
git add lib/types/index.ts lib/validation/schemas.ts lib/actions/processing.validation.test.ts
git commit -m "feat: add recurrenceRule to types and processing schemas"
```

---

### Task 3: Server actions persist recurrence_rule

**Files:**
- Modify: `lib/actions/processing.ts:77-108` (processToCalendar), `lib/actions/processing.ts:124-142` (processToNextActions)

**Interfaces:**
- Consumes: `RecurrenceRule` type (Task 2), updated schemas (Task 2), trigger behavior (Task 1).
- Produces (Task 5 calls these exact signatures):
  - `processToCalendar(taskId: string, scheduledAt: string, recurrenceRule?: RecurrenceRule | null): Promise<void>`
  - `processToNextActions(taskId: string, contexts?: string[], nextActionTitle?: string, recurrenceRule?: RecurrenceRule | null): Promise<void>`

Note: server actions hit the real DB; the repo's convention is validation-contract tests only (Task 2) plus E2E (Task 7). No new unit test file here — verification is compile + lint + existing suites.

- [ ] **Step 1: Update processToCalendar**

In `lib/actions/processing.ts`, add the type import at the top:

```ts
import type { RecurrenceRule } from '@/lib/types'
```

Change the signature and the two lines that use it:

```ts
export async function processToCalendar(
  taskId: string,
  scheduledAt: string,
  recurrenceRule: RecurrenceRule | null = null
) {
  const parsed = processToCalendarSchema.parse({ taskId, scheduledAt, recurrenceRule })
```

and the update payload:

```ts
    .update({
      status: 'calendar',
      scheduled_at: new Date(parsed.scheduledAt).toISOString(),
      recurrence_rule: parsed.recurrenceRule,
    })
```

(The rest of the function — title fetch, error handling, revalidates, GCal sync — is unchanged.)

- [ ] **Step 2: Update processToNextActions**

```ts
export async function processToNextActions(
  taskId: string,
  contexts: string[] = [],
  nextActionTitle?: string,
  recurrenceRule: RecurrenceRule | null = null
) {
  const parsed = processToNextActionsSchema.parse({ taskId, contexts, nextActionTitle, recurrenceRule })
  const { supabase, user } = await authedClient()
  const update: Record<string, unknown> = {
    status: 'next_actions',
    contexts: parsed.contexts,
    recurrence_rule: parsed.recurrenceRule,
  }
  if (parsed.nextActionTitle?.trim()) update.title = parsed.nextActionTitle.trim()
```

(The rest is unchanged.)

- [ ] **Step 3: Verify compile + lint + tests**

Run: `npx tsc --noEmit && npm run lint && npm run test:run`
Expected: all PASS, no type errors (existing callers pass 2–3 args; the new parameter is optional).

- [ ] **Step 4: Commit**

```bash
git add lib/actions/processing.ts
git commit -m "feat: persist recurrence_rule in processing server actions"
```

---

### Task 4: RepeatPicker component (TDD)

**Files:**
- Create: `components/ui/RepeatPicker.tsx`
- Test: `components/ui/RepeatPicker.test.tsx`

**Interfaces:**
- Consumes: `RecurrenceRule` from `@/lib/types` (Task 2); `glass-input` CSS class (exists in `app/globals.css`).
- Produces (Task 5 uses this): `RepeatPicker({ value, onChange, disabled }: { value: RecurrenceRule | null; onChange: (value: RecurrenceRule | null) => void; disabled?: boolean })` — a labeled `<select>` whose accessible label is exactly `Repeat`; empty selection maps to `null`.

- [ ] **Step 1: Write the failing test**

Create `components/ui/RepeatPicker.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RepeatPicker } from './RepeatPicker'

describe('RepeatPicker', () => {
  it('renders a select labeled "Repeat" with None + 4 presets', () => {
    render(<RepeatPicker value={null} onChange={() => {}} />)
    const select = screen.getByLabelText('Repeat')
    const options = [...select.querySelectorAll('option')].map((o) => o.textContent)
    expect(options).toEqual(['None', 'Daily', 'Weekly', 'Monthly', 'Yearly'])
  })

  it('shows None selected when value is null', () => {
    render(<RepeatPicker value={null} onChange={() => {}} />)
    expect(screen.getByLabelText('Repeat')).toHaveValue('')
  })

  it('reflects a non-null value', () => {
    render(<RepeatPicker value="monthly" onChange={() => {}} />)
    expect(screen.getByLabelText('Repeat')).toHaveValue('monthly')
  })

  it('calls onChange with the rule when a preset is chosen', () => {
    const onChange = vi.fn()
    render(<RepeatPicker value={null} onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: 'weekly' } })
    expect(onChange).toHaveBeenCalledWith('weekly')
  })

  it('calls onChange with null when None is chosen', () => {
    const onChange = vi.fn()
    render(<RepeatPicker value="daily" onChange={onChange} />)
    fireEvent.change(screen.getByLabelText('Repeat'), { target: { value: '' } })
    expect(onChange).toHaveBeenCalledWith(null)
  })

  it('disables the select when disabled', () => {
    render(<RepeatPicker value={null} onChange={() => {}} disabled />)
    expect(screen.getByLabelText('Repeat')).toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run components/ui/RepeatPicker.test.tsx`
Expected: FAIL — cannot resolve `./RepeatPicker`.

- [ ] **Step 3: Implement the component**

Create `components/ui/RepeatPicker.tsx`:

```tsx
'use client'

import type { RecurrenceRule } from '@/lib/types'

const OPTIONS: { value: '' | RecurrenceRule; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
]

interface RepeatPickerProps {
  value: RecurrenceRule | null
  onChange: (value: RecurrenceRule | null) => void
  disabled?: boolean
}

/** Recurrence preset select used in the processing flow (spec: recurrence v1). */
export function RepeatPicker({ value, onChange, disabled }: RepeatPickerProps) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor="repeat-picker" className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Repeat
      </label>
      <select
        id="repeat-picker"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value === '' ? null : (e.target.value as RecurrenceRule))}
        className="glass-input text-sm"
        disabled={disabled}
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run components/ui/RepeatPicker.test.tsx`
Expected: 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ui/RepeatPicker.tsx components/ui/RepeatPicker.test.tsx
git commit -m "feat: add RepeatPicker recurrence select component"
```

---

### Task 5: Wire RepeatPicker into ProcessingOverlay

**Files:**
- Modify: `components/tasks/ProcessingOverlay.tsx` (state ~line 67, step4b ~lines 276-300, step6b ~lines 374-403)

**Interfaces:**
- Consumes: `RepeatPicker` (Task 4), `processToCalendar`/`processToNextActions` 3rd/4th params (Task 3), `RecurrenceRule` type (Task 2).
- Produces: processing UI where step4b (calendar datetime) and step6b (next action) each show the Repeat select; chosen value is passed to the server action. Used by E2E in Task 7 via `getByLabel('Repeat')`.

- [ ] **Step 1: Add imports and state**

In `components/tasks/ProcessingOverlay.tsx`:

Add imports (near the ContextPicker import):

```tsx
import { RepeatPicker } from '@/components/ui/RepeatPicker'
import type { RecurrenceRule } from '@/lib/types'
```

Note the file already has `import type { Task } from '@/lib/types'` — merge into one line:

```tsx
import type { Task, RecurrenceRule } from '@/lib/types'
```

Add state after `const [nextActionTitle, setNextActionTitle] = useState(task.title)` (line 67):

```tsx
  const [recurrence, setRecurrence] = useState<RecurrenceRule | null>(null)
```

- [ ] **Step 2: Add picker to step4b (calendar)**

Replace the `case 'step4b':` block's inner `<div className="flex flex-col gap-3">` content so the picker sits between the datetime input and the action button, and the action passes `recurrence`:

```tsx
            <div className="flex flex-col gap-3">
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="glass-input"
                autoFocus
                disabled={isPending}
              />
              <RepeatPicker value={recurrence} onChange={setRecurrence} disabled={isPending} />
              <ActionButton
                onClick={() => finish(() => processToCalendar(task.id, new Date(scheduledAt).toISOString(), recurrence))}
                disabled={!scheduledAt || isPending}
                loading={isPending}
              >
                Add to Calendar →
              </ActionButton>
            </div>
```

- [ ] **Step 3: Add picker to step6b (next actions)**

In the `case 'step6b':` block, insert the picker between `<ContextPicker ... />` and `<ActionButton ...>`, and pass `recurrence` as the 4th argument:

```tsx
              <ContextPicker value={selectedContexts} onChange={setSelectedContexts} userContexts={userContexts} />
              <RepeatPicker value={recurrence} onChange={setRecurrence} disabled={isPending} />
              <ActionButton
                onClick={() => finish(() => processToNextActions(task.id, selectedContexts, nextActionTitle.trim() || undefined, recurrence))}
                loading={isPending}
                disabled={isPending || !nextActionTitle.trim()}
              >
                Add to Next Actions →
              </ActionButton>
```

- [ ] **Step 4: Verify compile + lint + build**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add components/tasks/ProcessingOverlay.tsx
git commit -m "feat: add Repeat picker to processing calendar and next-action steps"
```

---

### Task 6: Repeat icon on web task rows

**Files:**
- Modify: `components/tasks/TaskCard.tsx` (imports line 4, metadata chips ~lines 101-123)
- Modify: `components/tasks/CalendarList.tsx` (imports line 5, CalendarCard content ~line 172)

**Interfaces:**
- Consumes: `Task.recurrence_rule` (Task 2 type). Both components already receive full `Task` rows — pages select `*`, so no query changes.
- Produces: visible indicator with accessible label `Repeats {rule}` (exact string, e.g. `Repeats weekly`) — asserted by E2E in Task 7.

- [ ] **Step 1: TaskCard (Next Actions / Waiting For rows)**

In `components/tasks/TaskCard.tsx`:

Line 4, add `Repeat` to the lucide import:

```tsx
import { Repeat, Tag, UserPlus } from 'lucide-react'
```

Change the metadata-chips condition (line 101) to include recurrence:

```tsx
        {!isEditingContexts && (projectTitle || task.contexts.length > 0 || task.recurrence_rule) && (
```

Inside that chips `<div>`, after the `{projectTitle && (...)}` block and before `{task.contexts.map(...)}`, add:

```tsx
            {task.recurrence_rule && (
              <span
                className="inline-flex items-center text-sm"
                style={{ color: 'var(--text-secondary)' }}
                aria-label={`Repeats ${task.recurrence_rule}`}
                title={`Repeats ${task.recurrence_rule}`}
              >
                <Repeat className="w-3.5 h-3.5" aria-hidden="true" />
              </span>
            )}
```

- [ ] **Step 2: CalendarCard (Calendar rows)**

In `components/tasks/CalendarList.tsx`:

Line 5, add `Repeat` to the lucide import:

```tsx
import { Inbox, Trash2, Clock, CheckCircle2, AlertTriangle, Loader2, Repeat } from 'lucide-react'
```

In `CalendarCard`, directly after the title `<p>` (line 172), add:

```tsx
        {task.recurrence_rule && (
          <span
            className="flex items-center gap-1 text-xs mt-1"
            style={{ color: 'var(--text-muted)' }}
            aria-label={`Repeats ${task.recurrence_rule}`}
          >
            <Repeat className="w-3 h-3" aria-hidden="true" />
            Repeats {task.recurrence_rule}
          </span>
        )}
```

- [ ] **Step 3: Verify compile + lint + unit tests**

Run: `npx tsc --noEmit && npm run lint && npm run test:run`
Expected: all PASS (InboxList/AttachmentSection tests unaffected).

- [ ] **Step 4: Commit**

```bash
git add components/tasks/TaskCard.tsx components/tasks/CalendarList.tsx
git commit -m "feat: show repeat indicator on web task and calendar rows"
```

---

### Task 7: E2E — recurring next action reappears after completion

**Files:**
- Create: `tests/e2e/views/recurrence.spec.ts`

**Interfaces:**
- Consumes: `captureTask` fixture (`tests/e2e/fixtures.ts`), ProcessingOverlay button texts (unchanged), `Repeat` select label (Task 5), `Repeats weekly` aria-label (Task 6), TaskCard done-button aria-label `Mark "{title}" as done`, DB trigger (Task 1).
- Produces: regression coverage for the full write→display→regenerate loop. Calendar-side regeneration math is covered by Task 1's SQL verification (web calendar rows have no complete button, by design).

- [ ] **Step 1: Write the E2E spec**

Create `tests/e2e/views/recurrence.spec.ts`:

```ts
import { test, expect } from '../fixtures'
import type { Page } from '@playwright/test'

/** Click the hidden Process button via DOM evaluate, then wait for the dialog. */
async function openProcessing(page: Page, taskTitle: string) {
  await page.locator(`button[aria-label='Process "${taskTitle}"']`).evaluate(el => (el as HTMLElement).click())
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible({ timeout: 5_000 })
  return dialog
}

/** Walk the processing wizard to step6b (next action clarification). */
async function walkToNextActionStep(dialog: ReturnType<Page['getByRole']>) {
  await dialog.getByRole('button', { name: 'Yes' }).click()                            // Step 1: actionable
  await dialog.getByRole('button', { name: 'No — keep processing' }).click()           // Step 2: not 2-min
  await dialog.getByRole('button', { name: 'Yes' }).click()                            // Step 3: mine
  await dialog.getByRole('button', { name: /No — do it as soon as possible/ }).click() // Step 4: no date
  await dialog.getByRole('button', { name: 'Yes' }).click()                            // Step 5: single step
}

test.describe('Recurring tasks', () => {
  test('recurring next action reappears after completion', async ({ page, captureTask }) => {
    const task = await captureTask(`E2E — recurring ${Date.now()}`)
    const dialog = await openProcessing(page, task.title)

    await walkToNextActionStep(dialog)
    await dialog.getByLabel('Repeat').selectOption('weekly')
    await dialog.getByRole('button', { name: 'Add to Next Actions →' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 8_000 })

    // Shows up in Next Actions with the repeat indicator
    await page.goto('/next-actions')
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByLabel('Repeats weekly')).toBeVisible()

    // Complete it — the DB trigger must clone a fresh occurrence
    await page.locator(`button[aria-label='Mark "${task.title}" as done']`).click()
    // Completion animates out, server action runs, trigger inserts the clone.
    // Reload to read fresh server state rather than racing the optimistic UI.
    await page.waitForTimeout(2_000)
    await page.reload()
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })
    await expect(page.getByLabel('Repeats weekly')).toBeVisible()
    // No inline cleanup needed — global-setup deletes all E2E% tasks before each run
  })

  test('non-recurring next action does not reappear after completion', async ({ page, captureTask }) => {
    const task = await captureTask(`E2E — one-shot ${Date.now()}`)
    const dialog = await openProcessing(page, task.title)

    await walkToNextActionStep(dialog)
    // Leave Repeat at None
    await dialog.getByRole('button', { name: 'Add to Next Actions →' }).click()
    await expect(dialog).not.toBeVisible({ timeout: 8_000 })

    await page.goto('/next-actions')
    await expect(page.getByText(task.title)).toBeVisible({ timeout: 8_000 })

    await page.locator(`button[aria-label='Mark "${task.title}" as done']`).click()
    await page.waitForTimeout(2_000)
    await page.reload()
    await expect(page.getByText(task.title)).not.toBeVisible({ timeout: 8_000 })
  })
})
```

- [ ] **Step 2: Run the new spec**

Run: `npx playwright test tests/e2e/views/recurrence.spec.ts`
Expected: 2 tests PASS. (Requires `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` in `.env.local`; the dev server auto-starts. The recurring test fails at the final assertion if the Task 1 trigger is not applied to the target database — apply it first.)

- [ ] **Step 3: Run the full E2E suite to catch regressions in existing processing tests**

Run: `npm run test:e2e`
Expected: all PASS (the Repeat select is additive; existing step6b tests never touch it and its default None preserves old behavior).

- [ ] **Step 4: Commit**

```bash
git add tests/e2e/views/recurrence.spec.ts
git commit -m "test: add E2E coverage for recurring task regeneration"
```

---

### Task 8: Final verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Full local gates**

Run: `npx tsc --noEmit && npm run lint && npm run test:run && npm run build`
Expected: all PASS.

- [ ] **Step 2: Mobile still compiles against the shared Task type**

Run: `cd mobile && npx tsc --noEmit && cd ..`
Expected: PASS — mobile only reads `recurrence_rule` truthiness (`!!item.recurrence_rule`), and `RecurrenceRule | null` narrows `string | null` without breaking reads.

- [ ] **Step 3: Confirm working tree is clean and log is coherent**

Run: `git status --porcelain && git log --oneline -8`
Expected: no uncommitted changes from this plan; commits from Tasks 1-7 present.
