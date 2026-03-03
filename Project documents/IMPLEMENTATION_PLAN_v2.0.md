# GTD App — Implementation Plan v2.0

**Stack**: Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4 · Supabase · dnd-kit · Google Calendar API · Recharts (new)
**Prerequisite**: All MVP sessions (1–18) complete; MVP deployed (or local dev ready)
**Source**: `UserStories_GTD_App_v2.0.md`
**Date**: 2026-02-26

---

## Phase Overview

| Phase | Sessions | Focus | Story Points |
|-------|----------|-------|-------------|
| Phase 11 — UX & Execution | 20–22 | Go Back · Contexts · Today View | 13 |
| Phase 12 — Delegation & Tickler | 23–24 | WF Due Dates · Tickler | 11 |
| Phase 13 — Weekly Review | 25–26 | Review Flow · Summary | 13 |
| Phase 14 — Search & Analytics | 27–28 | Search · Dashboard | 13 |
| **Total** | **9 sessions** | | **50 pts** |

---

## DB Migrations Required Before Starting

Before coding, apply these migrations to the Supabase database:

```sql
-- 1. Add completed_at timestamp (for Analytics cycle time)
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_at timestamptz;

-- Auto-populate completed_at when a task is moved to 'done'
CREATE OR REPLACE FUNCTION set_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'done' AND OLD.status <> 'done' THEN
    NEW.completed_at = NOW();
  ELSIF NEW.status <> 'done' THEN
    NEW.completed_at = NULL;  -- clear if un-done
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_completed_at
BEFORE UPDATE ON tasks
FOR EACH ROW EXECUTE FUNCTION set_completed_at();

-- 2. user_preferences table (for Weekly Review last-reviewed date)
CREATE TABLE IF NOT EXISTS user_preferences (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  last_weekly_review timestamptz,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "user owns preferences"
  ON user_preferences FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
```

---

## Phase 11 — UX & Execution (Sessions 20–22)

### Session 20 — Processing "Go Back" + Context Tags on Tasks

**Stories**: US-101, US-102
**Estimated time**: 1–2h
**Story points**: 5

#### Tasks

**1. ProcessingOverlay — Back button (US-101)**

- [x] Add `stepHistory: Step[]` state to `ProcessingOverlay`
- [x] On each forward navigation (`setStep(nextStep)`), push current step to `stepHistory`
- [x] Add `handleBack()` function: `setStep(stepHistory.pop())`
- [x] Render `<BackButton>` at steps 2, 3, 4, 5 (hide at step 1) — shown when `stepHistory.length > 0`
- [x] Style: ghost/glass button, left-aligned below step content, with `ChevronLeft` icon
- [x] Add `Backspace` / `Alt+←` keyboard handler via `useEffect` in ProcessingOverlay (skips when focused in INPUT/TEXTAREA)
- [ ] Test: cycle back through all 5 steps; verify no DB write occurs on back-navigation

**2. Context tags — Data & UI (US-102)**

- [x] Create constants file `lib/constants/contexts.ts`
- [x] Create `components/ui/ContextPicker.tsx` — multi-select pill toggle component
  - Props: `value: string[]`, `onChange: (v: string[]) => void`
  - Renders default contexts as toggleable pills + custom `@context` free-text input
- [x] Integrate `ContextPicker` into `ProcessingOverlay` at `step5b` (new sub-step after "No — Next Actions")
  - Contexts are optional (zero selection allowed)
- [x] Update `processToNextActions(taskId, contexts: string[] = [])` server action signature
- [x] Update `lib/actions/processing.ts` → `processToNextActions` to write `contexts`
- [x] Context chips already displayed on `TaskCard` (was pre-built in earlier session) ✅
- [x] Add inline context edit in `TaskCard` — Tag icon in hover actions, `ContextPicker` expands inline
  - New server action: `updateTaskContexts(taskId, contexts)` in `tasks.ts`
- [ ] Test: process a task to Next Actions, add @office context, verify it persists and displays

---

### Session 21 — Context Filter on Next Actions

**Stories**: US-103
**Estimated time**: 1h
**Story points**: 3

#### Tasks

- [x] All requirements already implemented inside `TaskList.tsx` (pre-built in earlier session):
  - `allContexts` derived from tasks via `flatMap` + `Set`
  - `ContextChip` components with `aria-pressed`, "All" + per-context chips
  - `activeContext` state; single-select with deselect on repeat click
  - `optimisticTasks.filter()` for client-side filtering
  - Empty state with context-specific message
- [ ] Test: add tasks with different contexts, verify filter shows/hides correctly

---

### Session 22 — Today Focus View

**Stories**: US-104
**Estimated time**: 1.5–2h
**Story points**: 5

#### Tasks

- [x] Create `app/(app)/today/page.tsx` — server component with `Promise.all` (3 queries + overdue)
- [x] Create `components/tasks/TodayView.tsx` — sections: Overdue (amber), Scheduled, Due Today; inline done/trash actions; empty state
- [x] Add `/today` to sidebar with `Sun` icon and `todayCount` badge
- [x] Update `app/(app)/layout.tsx` — `Promise.all` for inbox + due + scheduled counts → `todayCount`
- [x] Update `AppLayout` — add `todayCount` prop threaded to Sidebar
- [x] Update `Sidebar` — Today nav item with badge
- [x] Create `app/(app)/today/loading.tsx` skeleton
- [ ] Test: create tasks with today's date in various lists; verify all appear in Today

---

## Phase 12 — Delegation & Tickler (Sessions 23–24)

### Session 23 — Delegation Due Dates + GCal Reminder

**Stories**: US-105, US-106
**Estimated time**: 2h
**Story points**: 8

#### Tasks

**1. Waiting For due dates (US-105)**

- [x] Add `wfDueDate` state + "Expected by (optional)" date input in `ProcessingOverlay` step2b
- [x] `processToWaitingFor(taskId, delegatedTo, dueDate?: string)` — updated signature + writes `due_date`
- [x] `WaitingForList` due date badge + overdue highlight — pre-built in earlier session ✅
- [x] Inline due date edit in `WaitingForList` — Calendar icon in hover actions → date input + Save/Clear/Cancel
- [x] `updateWaitingForDueDate(taskId, dueDate)` server action in `tasks.ts`
- [x] Today view: updated Due Today query to `.in('status', ['next_actions', 'waiting_for'])`
- [ ] Test: process WF task with due date; verify date shows in list, overdue highlights, appears in Today

**2. GCal reminder for delegated tasks (US-106)**

- [x] `CalendarEventInput` updated: added `date?: string` and `allDay?: boolean` fields
- [x] `createGCalEvent` updated: `allDay: true` → uses `{ date }` fields (all-day event API)
- [x] `syncWaitingForReminder(taskId, dueDate)` in `calendar.ts` — fetches task title/delegatedTo, creates all-day event on `dueDate - 1 day`, skips if reminder date is past
- [x] `cleanupWFReminderIfNeeded(taskId)` in `calendar.ts` — checks status = waiting_for + event_id, deletes GCal event, clears field
- [x] `processToWaitingFor` calls `syncWaitingForReminder` when dueDate is set (non-fatal)
- [x] `updateWaitingForDueDate` calls `cleanupWFReminderIfNeeded` then `syncWaitingForReminder` (delete old, create new)
- [x] `markTaskDone` + `moveToInbox` both call `cleanupWFReminderIfNeeded` (non-fatal)
- [ ] Test: create WF task with due date → GCal event for day-1; change date → event updates; complete → event deleted

---

### Session 24 — Someday/Maybe Tickler Date

**Stories**: US-107
**Estimated time**: 1h
**Story points**: 3

#### Tasks

- [ ] Add optional "Review on" DatePicker to `ProcessingOverlay` at the Someday/Maybe step
  - Label: "Remind me to review on (optional)"
  - Placeholder: "Pick a date"
- [ ] Update `processToSomedayMaybe(taskId, reviewDate?: string)` server action to write `due_date`
- [ ] Update `SomedayList` task cards:
  - Display "Review [date]" badge (muted, non-urgent style)
  - When `due_date <= today`: amber badge "Review now"
- [ ] Sidebar: update inbox count query in `AppLayout` to also count Someday/Maybe items with `due_date <= today`
  - Or show a separate badge on the Someday/Maybe nav item
- [ ] Add due date to Today view's "Review Today" section (already specified in US-104)
- [ ] Add edit option for review date on existing Someday/Maybe tasks
- [ ] Test: send task to Someday/Maybe with review date; verify badge appears on due date

---

## Phase 13 — Weekly Review (Sessions 25–26)

### Session 25 — Weekly Review Core Flow

**Stories**: US-108 (partial — Steps 1–5)
**Estimated time**: 3–4h
**Story points**: 5

#### Tasks

- [ ] Create `app/(app)/weekly-review/page.tsx` — entry screen
  - Shows last review date (from `user_preferences`)
  - "Start Weekly Review" CTA button
  - Brief description of what the review covers

- [ ] Create `components/review/WeeklyReviewFlow.tsx` — main step controller
  - `currentStep` state (1–6)
  - Step progress bar at top: "Step N of 6 — [Step Name]"
  - Renders the active step component
  - "Exit" button (returns to Inbox without saving)
  - Step history NOT saved (restart from Step 1 each time)

- [ ] **Step 1: Get Clear (Inbox)**
  - Create `components/review/ReviewStep1Inbox.tsx`
  - Shows current inbox count
  - "Open Inbox" button → opens `/inbox` in new tab
  - "My inbox is at zero" confirmation checkbox → enables "Continue" button
  - If inbox is already empty: auto-show success state

- [ ] **Step 2: Review Waiting For**
  - Create `components/review/ReviewStep2WaitingFor.tsx`
  - Fetches all Waiting For tasks (client-side)
  - Renders each task with inline actions: Mark Done, Move to Next Actions, Leave
  - Overdue delegations highlighted in amber
  - "Waiting For reviewed" → advance to Step 3

- [ ] **Step 3: Review Projects**
  - Create `components/review/ReviewStep3Projects.tsx`
  - Fetches all active projects with their first-step task
  - Flags projects without a first-step task: warning badge "No next action"
  - Inline "Promote plan item" button for projects missing a first step (reuses `promoteRoughPlanItem` action)
  - "Projects reviewed" → advance to Step 4

- [ ] **Step 4: Review Next Actions**
  - Create `components/review/ReviewStep4NextActions.tsx`
  - Fetches Next Actions, grouped by context (if any)
  - Inline actions: Mark Done, Move to Someday/Maybe, Move to Trash
  - "Next Actions reviewed" → advance to Step 5

- [ ] **Step 5: Review Someday/Maybe**
  - Create `components/review/ReviewStep5SomedayMaybe.tsx`
  - Fetches Someday/Maybe items, review-date-overdue items first
  - Inline actions: Activate (→ Next Actions), Archive (→ Trash), Update review date
  - "Someday reviewed" → advance to Step 6

- [ ] Add `app/(app)/weekly-review/loading.tsx`
- [ ] Add "Weekly Review" to sidebar navigation
  - Icon: `RefreshCw` or `CheckCircle2` from lucide-react
  - Sub-label: "Last: [date]" or "Never"

---

### Session 26 — Weekly Review Summary + user_preferences

**Stories**: US-108 (completion), US-109
**Estimated time**: 2h
**Story points**: 8

#### Tasks

**1. user_preferences table & server actions**

- [ ] Apply DB migration (see top of this document) to create `user_preferences` table
- [ ] Create `lib/actions/preferences.ts` (`'use server'`):
  - `getLastWeeklyReview(): Promise<Date | null>`
  - `saveWeeklyReviewComplete(): Promise<void>` — upserts `last_weekly_review = now()`
- [ ] Update `WeeklyReviewFlow` to fetch and display last review date

**2. Step 6: Done / Summary (US-109)**

- [ ] Create `components/review/ReviewStep6Summary.tsx`
  - On mount, call `saveWeeklyReviewComplete()` to persist the timestamp
  - Fetch week stats via parallel Supabase queries:
    - Tasks completed this week: `completed_at >= 7_days_ago AND status = 'done'`
    - Tasks captured this week: `created_at >= 7_days_ago AND status = 'inbox'` at time of capture (use `created_at`)
    - Projects completed this week: `projects` where `status = 'completed' AND updated_at >= 7_days_ago`
    - Current system state: count by status
  - Render summary cards in glass style:
    - "X tasks completed this week"
    - "X tasks captured"
    - "X projects completed"
    - "Y active projects · Z next actions"
  - Congratulations message (vary by completion count for personalization)
  - "Close" button → navigate to `/inbox`

**3. Sidebar last-review label**

- [ ] Fetch `last_weekly_review` in `app/(app)/layout.tsx` (parallel to inbox count)
- [ ] Pass to `AppLayout` → `Sidebar` and display under the Weekly Review nav item

- [ ] Test: complete a full 6-step review; verify summary stats, timestamp saved, sidebar label updates

---

## Phase 14 — Search & Analytics (Sessions 27–28)

### Session 27 — Full-text Search

**Stories**: US-110
**Estimated time**: 2h
**Story points**: 5

#### Tasks

- [ ] Create `components/ui/SearchPalette.tsx` — command-palette style modal
  - Full-screen dark overlay with centered search input
  - Keyboard shortcut: `Cmd/Ctrl + K` to open (global listener in `AppLayout`)
  - `Escape` to close
  - Debounced input: 250ms before triggering query

- [ ] Search query (client-side Supabase, no server action needed — read-only):
  ```ts
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_date, project_id')
    .eq('user_id', user.id)
    .neq('status', 'trash')  // exclude trash by default
    .ilike('title', `%${term}%`)
    .limit(10)

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, status')
    .eq('user_id', user.id)
    .ilike('title', `%${term}%`)
    .limit(5)
  ```

- [ ] Result groups rendered in `SearchPalette`:
  - **Tasks** — task title (bold match), status badge, due date
  - **Projects** — project title (bold match), "Active" / "Completed" badge
  - Click task result → navigate to its list page (e.g., `/next-actions`) with the task scrolled into view or highlighted
  - Click project result → navigate to `/projects/{id}`

- [ ] "Include trash" toggle (checkbox below results) — re-runs query without the `neq('status', 'trash')` filter

- [ ] Empty result state: "No results for '{term}'"

- [ ] Add search icon button to `Sidebar` header → opens `SearchPalette`
  - Also register global `Cmd/Ctrl+K` keydown listener in `AppLayout`

- [ ] Accessibility: trap focus inside `SearchPalette`; `aria-label="Search"` on input; results list uses `role="listbox"` with `aria-activedescendant` for keyboard navigation (↑/↓ arrows + Enter to navigate)

- [ ] Test: search for partial task title; verify results from multiple lists appear; verify trash excluded by default

---

### Session 28 — Analytics Dashboard

**Stories**: US-111
**Estimated time**: 3–4h
**Story points**: 8

#### Tasks

- [ ] Install charting library:
  ```bash
  npm install recharts
  ```
  (Recharts is React-native, TypeScript-friendly, ~50 KB gzipped)

- [ ] Apply DB migration: ensure `completed_at` column and trigger exist (see top of plan)

- [ ] Create `app/(app)/analytics/page.tsx` (server component)
  - Metadata: `title: 'Analytics'`
  - Fetch initial data for default period (last 30 days):
    - Daily completions: `SELECT date_trunc('day', completed_at) as day, count(*) FROM tasks WHERE user_id = $1 AND completed_at >= $2 GROUP BY day ORDER BY day`
    - Cycle time: `SELECT avg(completed_at - created_at) FROM tasks WHERE status = 'done' AND completed_at >= $2`
    - Capture vs. process: count created vs. count moved out of inbox in period
    - Project stats: completed projects, active projects count
    - Status distribution: count by status (current snapshot)
  - Note: use Supabase RPC for aggregation queries (`.rpc('get_analytics', { p_user_id, p_from })`) to avoid N+1 queries

- [ ] Create Supabase RPC function for analytics:
  ```sql
  CREATE OR REPLACE FUNCTION get_analytics(p_user_id uuid, p_from timestamptz)
  RETURNS json AS $$
  SELECT json_build_object(
    'completed_by_day', (
      SELECT json_agg(row_to_json(r)) FROM (
        SELECT date_trunc('day', completed_at)::date AS day, count(*)::int AS count
        FROM tasks WHERE user_id = p_user_id AND completed_at >= p_from
        GROUP BY 1 ORDER BY 1
      ) r
    ),
    'avg_cycle_days', (
      SELECT round(avg(extract(epoch FROM (completed_at - created_at)) / 86400))
      FROM tasks WHERE user_id = p_user_id AND completed_at >= p_from
    ),
    'tasks_captured', (
      SELECT count(*)::int FROM tasks WHERE user_id = p_user_id AND created_at >= p_from
    ),
    'status_counts', (
      SELECT json_object_agg(status, cnt) FROM (
        SELECT status, count(*)::int AS cnt FROM tasks WHERE user_id = p_user_id GROUP BY status
      ) s
    )
  );
  $$ LANGUAGE sql SECURITY DEFINER;
  ```

- [ ] Create `app/(app)/analytics/loading.tsx` skeleton

- [ ] Create analytics components:

  - `components/analytics/PeriodSelector.tsx` — "7d / 30d / 3m" tab selector
    - On change: client-side re-fetch with new date range

  - `components/analytics/CompletionChart.tsx` — Recharts `BarChart` or `AreaChart`
    - X-axis: dates, Y-axis: tasks completed per day

  - `components/analytics/StatCard.tsx` — reusable glass stat card
    - Props: `label`, `value`, `sublabel`
    - Used for: cycle time, tasks captured, projects completed

  - `components/analytics/StatusDistribution.tsx` — Recharts `PieChart` (donut)
    - Shows current task distribution by status
    - Color-coded per status (inbox=indigo, next_actions=emerald, etc.)

  - `components/analytics/RecentCompletions.tsx` — scrollable list
    - Last 10 completed tasks with task title + completion date

- [ ] Add "Analytics" to sidebar navigation
  - Icon: `BarChart2` from lucide-react
  - Position: secondary nav section (below main GTD lists)

- [ ] Test: complete several tasks across multiple days; verify charts reflect data; test all 3 time periods

---

## Vibe Coding Session Order (v2.0)

| Session | Feature | Stories | Points | Dependencies |
|---------|---------|---------|--------|-------------|
| 20 | Go Back + Context Tags | US-101, US-102 | 5 | None |
| 21 | Context Filter | US-103 | 3 | Session 20 |
| 22 | Today Focus View | US-104 | 5 | None |
| 23 | Delegation Due Dates + GCal Reminder | US-105, US-106 | 8 | Session 22 |
| 24 | Someday/Maybe Tickler | US-107 | 3 | None |
| 25 | Weekly Review Core Flow (Steps 1–5) | US-108 | 5 | Sessions 20–24 |
| 26 | Weekly Review Summary + user_preferences | US-108, US-109 | 8 | Session 25 |
| 27 | Full-text Search | US-110 | 5 | None |
| 28 | Analytics Dashboard | US-111 | 8 | Session 26 (for user_preferences) |

**Total**: 9 sessions · 50 story points

---

## Risk & Notes

| Risk | Mitigation |
|------|-----------|
| GCal all-day event API differences | Test `date` vs `dateTime` field in `createGCalEvent`; add `allDay` param cleanly |
| Recharts bundle size | Tree-shake: import only `BarChart`, `PieChart`, `Area` components used |
| Analytics SQL aggregation in Supabase | Use `.rpc()` for complex queries; test locally with Supabase CLI |
| Weekly Review scope creep | Keep all review steps as read+action on existing data; no new data models except `user_preferences` |
| `completed_at` backfill | Existing `done` tasks will have `completed_at = null`; analytics will only count tasks done after the migration |
