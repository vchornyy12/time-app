# User Stories — GTD App v2.0

## Document Information
- **Product**: GTD App
- **Version**: 2.0 (Post-MVP Enhancements)
- **Date**: 2026-02-26
- **Predecessor**: `UserStories_GTD_App_MVP.md` v1.0
- **Source Notes**: `New_User_Stories.md` + GTD methodology gaps analysis
- **Status**: Draft — Backlog

---

## Epic Index

| Epic | ID | Stories | Phase | Story Points |
|------|----|---------|-------|-------------|
| Processing Undo | EPIC-BACK | US-101 | Phase 11 | 2 |
| Context Tags | EPIC-CONTEXT | US-102, US-103 | Phase 11 | 6 |
| Daily Focus View | EPIC-TODAY | US-104 | Phase 11 | 5 |
| Delegation Enhancements | EPIC-DELEGATE2 | US-105, US-106 | Phase 12 | 8 |
| Someday/Maybe Tickler | EPIC-TICKLER | US-107 | Phase 12 | 3 |
| Weekly Review | EPIC-REVIEW | US-108, US-109 | Phase 13 | 13 |
| Full-text Search | EPIC-SEARCH | US-110 | Phase 14 | 5 |
| Analytics Dashboard | EPIC-ANALYTICS | US-111 | Phase 14 | 8 |

**Total Story Points (estimate)**: 50

---

## GTD Alignment Notes

All features in this document are grounded in David Allen's *Getting Things Done* methodology:

| Feature | GTD Chapter / Principle |
|---------|------------------------|
| Processing Undo | Chapter 6 — Clarifying (forgiving capture) |
| Context Tags | Chapter 8 — Next Actions, contexts (@home, @office…) |
| Daily Focus View | Chapter 9 — Weekly Review + Daily Planning |
| Delegation Due Dates | Chapter 7 — Waiting For; expected date practice |
| GCal Reminder for WF | Chapter 7 — Tickler / follow-up mechanism |
| Someday/Maybe Tickler | Chapter 9 — Someday/Maybe review dates |
| Weekly Review | Chapter 9 — The Weekly Review (the most critical GTD habit) |
| Full-text Search | Chapter 5 — Trusted System; retrieval of reference material |
| Analytics Dashboard | Chapter 9 — Weekly Review outcomes + personal metrics |

---

---

# EPIC-BACK: Processing Undo

---

## US-101 — "Go Back" Button in Inbox Processing

### Story Information
- **Story ID**: US-101
- **Epic**: EPIC-BACK — Processing Undo
- **Sprint**: [TBD — Phase 11]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 2
- **Priority**: P2-Medium

---

### User Story

**As a** user processing tasks in my Inbox
**I want to** step back to the previous question in the processing flow
**So that** I can correct a mistake without cancelling the whole session and starting over

---

### Context and Background

**Business Context**
- Business problem: The 5-step processing flow is a modal overlay with no undo. If a user accidentally taps "No" instead of "Yes" they must cancel and restart the entire task.
- User pain point: Loss of flow and frustration during rapid inbox processing sessions.
- Expected impact: Reduces abandonment of processing sessions; makes the tool more forgiving and usable.

**Technical Context**
- Current system state: `ProcessingOverlay` component manages `step` state (1–5) with forward-only navigation.
- What changes: Add a `step` history stack; render a "Back" button at steps 2–5; on click, pop the history and restore the previous step state.
- Related features: US-005 (Inbox Processing), EPIC-PROCESS.

**Dependencies**

Blocked by: nothing (self-contained UI change)

Blocks: nothing

---

### Acceptance Criteria

**AC-101-01 — Back button presence**
- **Given** I am on any processing step except Step 1 ("Is it actionable?")
- **When** I view the processing overlay
- **Then** a "Back" button is visible (glass/ghost style, left-aligned or secondary position)

**AC-101-02 — Back navigation preserves context**
- **Given** I am on Step 3 ("Is it for now?") after answering "Yes" to Steps 1 and 2
- **When** I click "Back"
- **Then** I return to Step 2 ("Is it for me?") with the same task still in context

**AC-101-03 — Back button absent on Step 1**
- **Given** I am on Step 1 ("Is it actionable?")
- **Then** no Back button is rendered (only Cancel/close)

**AC-101-04 — No database writes on back-navigation**
- **Given** I answer "Yes" to Step 2 and then click "Back"
- **Then** no task update is persisted until I complete the flow and confirm a final action

**AC-101-05 — Keyboard shortcut**
- **Given** the processing overlay is open on Step 2 or later
- **When** I press `Backspace` or `Alt + ←`
- **Then** the same back-navigation occurs

---

### Business Impact
- Reduces friction in the core processing ritual
- Increases session completion rate (fewer abandoned processing sessions)
- Aligns with GTD principle: clarifying should be thoughtful, not pressured

### Technical Notes
- Implement a `stepHistory: Step[]` array in `ProcessingOverlay` state
- On advancing to the next step, push current step to history
- On "Back", pop the last item from history and `setStep()`
- No new API calls needed — purely a client-side state change

---

---

# EPIC-CONTEXT: Context Tags

---

## US-102 — Assign Context Tags to Tasks

### Story Information
- **Story ID**: US-102
- **Epic**: EPIC-CONTEXT — Context Tags
- **Sprint**: [TBD — Phase 11]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P2-Medium

---

### User Story

**As a** user organizing my Next Actions
**I want to** tag tasks with GTD context labels (e.g., @home, @office, @phone, @computer, @errands)
**So that** I know which tasks I can do given my current location or available tools

---

### Context and Background

**Business Context**
- Business problem: Without contexts, the Next Actions list is one undifferentiated pile. A user at the airport cannot filter out tasks that require a computer or the office.
- User pain point: Mental overhead of scanning irrelevant items; distraction during focused execution.
- Expected impact: Users can view a short, relevant list for their current context, improving task execution rates.

**Technical Context**
- Current system state: `tasks.contexts` column already exists as `text[]` in the database schema. The data model is ready; no migration needed.
- What changes: UI to assign/edit contexts during Inbox Processing (Step 5 — Next Actions) and on any task card via an edit menu.
- Related features: US-103 (context filter), US-005 (processing flow).

**Dependencies**

Blocked by: nothing (DB field exists)

Blocks: US-103 (context filter depends on tags existing)

---

### Acceptance Criteria

**AC-102-01 — Context selection during processing**
- **Given** I am at Step 5 of processing ("Can it be done in 5 minutes? No → Next Actions")
- **When** the system routes the task to Next Actions
- **Then** a compact multi-select context picker is shown (predefined options: @home, @office, @phone, @computer, @errands, @waiting, + custom)
- **And** I can select zero or more contexts before confirming

**AC-102-02 — Context display on task cards**
- **Given** a task has one or more context tags
- **When** I view it in the Next Actions list
- **Then** the context tags are displayed as small chips/badges on the task card (e.g., `@office`, `@phone`)

**AC-102-03 — Edit context on existing task**
- **Given** a task is in Next Actions
- **When** I open the task's action menu
- **Then** I can add or remove context tags and save the change

**AC-102-04 — Persistence**
- **Given** I assign `[@office, @phone]` to a task
- **When** I refresh the page
- **Then** the contexts are still shown correctly

**AC-102-05 — Custom context**
- **Given** I type a custom context (e.g., `@garden`) in the picker
- **When** I confirm
- **Then** it is saved as a valid context tag alongside predefined ones

---

### Business Impact
- Unlocks the full power of GTD's context-based execution
- Enables focused "batching" of calls, errands, computer work
- Leverages existing DB schema — low engineering cost, high GTD value

### Technical Notes
- Predefined contexts stored as constants: `['@home', '@office', '@phone', '@computer', '@errands', '@waiting']`
- Custom contexts allowed as free-text with `@` prefix enforced
- Multi-select component: checkboxes or pill toggles inside the ProcessingOverlay and task edit modal
- DB write: `supabase.from('tasks').update({ contexts: selectedContexts })`

---

## US-103 — Filter Next Actions by Context

### Story Information
- **Story ID**: US-103
- **Epic**: EPIC-CONTEXT — Context Tags
- **Sprint**: [TBD — Phase 11]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P2-Medium

---

### User Story

**As a** user on the Next Actions page
**I want to** filter my Next Actions list by context tag
**So that** I only see tasks I can actually do right now given where I am and what I have

---

### Context and Background

**Business Context**
- Business problem: Without filtering, a large Next Actions list is cognitively overwhelming. GTD's power lies in surfacing only the relevant subset.
- User pain point: Time wasted scanning irrelevant tasks; decision fatigue.
- Expected impact: Shorter, more actionable lists per context → higher task execution rate.

**Technical Context**
- Current system state: Next Actions page (`/next-actions`) renders all tasks with `status = 'next_actions'` in a flat list.
- What changes: Add a context filter bar above the list; selected filter is applied client-side (or as a DB `.contains()` filter).
- Related features: US-102 (context tags must exist first).

**Dependencies**

Blocked by: US-102

Blocks: nothing

---

### Acceptance Criteria

**AC-103-01 — Filter bar rendering**
- **Given** I am on the Next Actions page
- **Then** a horizontal filter bar appears at the top with: "All" (default) + one chip per context that exists on at least one task in the list

**AC-103-02 — Single context filter**
- **Given** I click the `@office` filter chip
- **Then** only tasks tagged with `@office` are shown; others are hidden
- **And** the `@office` chip appears visually active/selected

**AC-103-03 — Clear filter**
- **Given** a context filter is active
- **When** I click "All" or click the active chip again
- **Then** all tasks are shown again

**AC-103-04 — No tasks for selected context**
- **Given** I select a context for which no tasks exist
- **Then** an empty state message appears: "No Next Actions in @[context] right now"

**AC-103-05 — Filter does not persist across page reloads**
- **Given** I set a filter to `@home` and navigate away
- **When** I return to Next Actions
- **Then** the filter resets to "All" (session-scoped, not persisted)

**AC-103-06 — Tasks with no context**
- **Given** a task has no context tags
- **When** the "All" filter is active
- **Then** untagged tasks are shown
- **When** any specific context filter is active
- **Then** untagged tasks are hidden

---

### Business Impact
- Makes the Next Actions list actionable rather than overwhelming
- Enables GTD "context batching" — do all phone calls in one sitting
- Zero new database infrastructure needed

### Technical Notes
- Filter bar: derive available contexts from current task list (client-side, no extra DB call)
- Filtering: `tasks.filter(t => selectedContext === null || t.contexts.includes(selectedContext))`
- Single-select filter for simplicity in v2.0 (multi-select can come later)
- Store filter in component state (not URL params in first iteration)

---

---

# EPIC-TODAY: Daily Focus View

---

## US-104 — Today Focus View

### Story Information
- **Story ID**: US-104
- **Epic**: EPIC-TODAY — Daily Focus View
- **Sprint**: [TBD — Phase 11]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P2-Medium

---

### User Story

**As a** user starting my day
**I want to** see a single "Today" view that shows everything due or scheduled for today
**So that** I have one focused starting point without switching between multiple lists

---

### Context and Background

**Business Context**
- Business problem: A user must visit Inbox, Next Actions, Calendar, and Projects to understand their day. This friction discourages daily planning.
- User pain point: Context-switching across 4+ views just to assess the day.
- Expected impact: A single daily "cockpit" that respects the GTD principle: start each day by choosing your most important next actions.

**Technical Context**
- Current system state: Tasks are distributed across `status` values. Calendar tasks have `scheduled_at`; Next Actions can have `due_date`.
- What changes: New `/today` route. Server-side query unions tasks where `due_date = today` (any status) + tasks where `scheduled_at = today` + first-step tasks of active projects where `due_date = today`.
- Related features: EPIC-GCAL (Calendar tasks), EPIC-PROJECT, EPIC-DEADLINE.

**Dependencies**

Blocked by: nothing (uses existing data)

Blocks: nothing

---

### Acceptance Criteria

**AC-104-01 — Navigation entry point**
- **Given** I am logged in
- **Then** "Today" appears in the sidebar navigation with a star or sun icon
- **And** if any tasks are due today, a count badge is shown

**AC-104-02 — Today view content — Calendar tasks**
- **Given** I have tasks with `status = 'calendar'` and `scheduled_at = today`
- **When** I open the Today view
- **Then** those tasks appear in a "Scheduled" section, sorted by time

**AC-104-03 — Today view content — Due Next Actions**
- **Given** I have tasks with `status = 'next_actions'` and `due_date = today`
- **When** I open the Today view
- **Then** those tasks appear in a "Due Today" section

**AC-104-04 — Today view content — Project first steps due today**
- **Given** a project's first-step task has `due_date = today`
- **When** I open the Today view
- **Then** that task appears in "Due Today" with a project label badge

**AC-104-05 — Overdue items**
- **Given** I have tasks with `due_date` in the past (not done)
- **Then** they appear in a separate "Overdue" section at the top, highlighted in amber/red

**AC-104-06 — Empty state**
- **Given** no tasks are due or scheduled today
- **Then** an encouraging empty state is shown: "You're clear for today. Time to choose what matters most." with a link to Next Actions.

**AC-104-07 — Task actions inline**
- **Given** a task appears in the Today view
- **Then** I can mark it done, move to trash, or open its detail without leaving Today

---

### Business Impact
- Reduces daily planning friction from 5 minutes to 30 seconds
- Respects the GTD daily review habit without adding a formal workflow
- High visibility feature for new user retention

### Technical Notes
- New page: `app/(app)/today/page.tsx`
- Server component with three parallel queries via `Promise.all`:
  1. Calendar tasks: `scheduled_at >= today_start AND scheduled_at < today_end`
  2. Next Actions due today: `status = 'next_actions' AND due_date = today`
  3. Project first-step tasks due today: join tasks + projects
- Overdue: `due_date < today AND status NOT IN ('done', 'trash')`
- Date comparisons use UTC; display in local timezone via `date-fns`
- Add `/today` to sidebar nav with calendar/sun icon and badge

---

---

# EPIC-DELEGATE2: Delegation Enhancements

---

## US-105 — Due Date for Delegated ("Waiting For") Tasks

### Story Information
- **Story ID**: US-105
- **Epic**: EPIC-DELEGATE2 — Delegation Enhancements
- **Sprint**: [TBD — Phase 12]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P2-Medium

---

### User Story

**As a** user who has delegated a task
**I want to** record the date by which I expect the delegated person to complete it
**So that** I know when to follow up and the system can surface overdue delegations

---

### Context and Background

**Business Context**
- Business problem: Delegated tasks without expected dates are invisible. GTD explicitly recommends tracking a "by-when" for every Waiting For item so it surfaces at the right time.
- User pain point: Forgetting to follow up on delegated tasks; missed commitments.
- Expected impact: Fewer dropped delegations; increased trust in the GTD system.

**Technical Context**
- Current system state: `tasks.due_date` column exists but is not shown on the Waiting For processing step or list view.
- What changes: Add a date picker to the "Waiting For" processing step; display due dates prominently in the Waiting For list; highlight overdue delegations.
- Related features: US-106 (GCal reminder), EPIC-LISTS (Waiting For view).

**Dependencies**

Blocked by: nothing

Blocks: US-106 (reminder requires a due_date to exist)

---

### Acceptance Criteria

**AC-105-01 — Date picker in processing flow**
- **Given** I route a task to "Waiting For" during Inbox Processing (Step 2: "Not for me")
- **Then** a date picker field appears alongside the "Delegated to" input
- **And** the date picker is optional (can be left blank)

**AC-105-02 — Due date display in Waiting For list**
- **Given** a Waiting For task has a due_date
- **When** I view the Waiting For list
- **Then** the due date is shown next to the task in a readable format (e.g., "Due Mar 15")

**AC-105-03 — Overdue delegation highlight**
- **Given** a Waiting For task's due_date has passed and it is not done
- **When** I view the Waiting For list
- **Then** the task is visually highlighted (amber border or "Overdue" badge)

**AC-105-04 — Edit due date after creation**
- **Given** a task is already in Waiting For
- **When** I open the task action menu
- **Then** I can set or update the due date

**AC-105-05 — Due date in Today view**
- **Given** a Waiting For task has due_date = today
- **When** I open the Today view (US-104)
- **Then** it appears in the "Due Today" section with a "Follow up" label

---

### Business Impact
- Closes the biggest GTD gap in the current delegation workflow
- Prevents "lost" delegations — a common pain point for busy professionals
- Directly enables the GCal reminder feature (US-106)

### Technical Notes
- `due_date` column already exists on the `tasks` table
- Add `due_date` DatePicker to `ProcessingOverlay` at the Waiting For step
- Update `processToWaitingFor(taskId, delegatedTo, dueDate?)` server action signature
- `WaitingForList` component: render due date badge + compute overdue state client-side

---

## US-106 — Automated Calendar Reminder for Delegated Tasks

### Story Information
- **Story ID**: US-106
- **Epic**: EPIC-DELEGATE2 — Delegation Enhancements
- **Sprint**: [TBD — Phase 12]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P3-Low

---

### User Story

**As a** user with a Google Calendar connected
**I want to** automatically receive a calendar reminder the day before a delegated task's due date
**So that** I remember to follow up without manually creating calendar events

---

### Context and Background

**Business Context**
- Business problem: Even with due dates on Waiting For tasks, follow-up still requires manual calendar entry. GTD's tickler system should automate this.
- User pain point: Manual calendar event creation duplicates effort; reminders get forgotten.
- Expected impact: Zero-effort follow-up reminders for every delegated task with a due date.

**Technical Context**
- Current system state: Google Calendar sync is implemented for Calendar-status tasks. The `syncCreateCalendarEvent` server action and Google Calendar API utils already exist.
- What changes: When a Waiting For task gets a due_date and Google Calendar is connected, create an all-day "follow-up reminder" event the day before.
- Related features: US-105, EPIC-GCAL.

**Dependencies**

Blocked by: US-105 (due date must exist), EPIC-GCAL (Google Calendar integration)

Blocks: nothing

---

### Acceptance Criteria

**AC-106-01 — Auto-create reminder event**
- **Given** I set a due_date on a Waiting For task AND Google Calendar is connected
- **When** the task is saved
- **Then** an all-day calendar event is created for (due_date − 1 day)
- **And** the event title is: `[Follow up] {Task Title} → {delegated_to}`

**AC-106-02 — Reminder when due_date is set after creation**
- **Given** I add a due_date to an existing Waiting For task that didn't have one
- **Then** the same calendar event creation logic runs

**AC-106-03 — Update reminder when due_date changes**
- **Given** a Waiting For task already has a reminder event
- **When** I change the due_date
- **Then** the existing calendar event is updated to (new_due_date − 1 day)

**AC-106-04 — Delete reminder when task is resolved**
- **Given** a Waiting For task has a reminder event
- **When** I mark the task as done or move it to another status
- **Then** the calendar reminder event is deleted from Google Calendar

**AC-106-05 — No reminder without Google Calendar**
- **Given** Google Calendar is not connected
- **When** I set a due_date on a Waiting For task
- **Then** no calendar event is created (due date is still saved and displayed)

**AC-106-06 — No reminder for due_date = tomorrow or sooner**
- **Given** the due_date is today or tomorrow
- **When** the event would land in the past
- **Then** no event is created (silently skipped), but due date is still saved

---

### Business Impact
- Completes the GTD delegation loop: capture → delegate → remind → follow up
- Differentiates the app for users who heavily rely on delegated work
- Leverages existing Google Calendar integration at low incremental cost

### Technical Notes
- New server action: `syncWaitingForReminder(taskId, dueDate, delegatedTo)`
- Store `google_calendar_event_id` on the Waiting For task (same column used for Calendar tasks)
- Reminder event: all-day event, `date` field = `due_date - 1 day` (ISO date string, not datetime)
- Use existing `createGCalEvent` utility; pass `allDay: true` flag
- Call this action from `processToWaitingFor` and from the edit action if due_date is added/changed

---

---

# EPIC-TICKLER: Someday/Maybe Tickler Date

---

## US-107 — Review Date for Someday/Maybe Items

### Story Information
- **Story ID**: US-107
- **Epic**: EPIC-TICKLER — Someday/Maybe Tickler
- **Sprint**: [TBD — Phase 12]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P3-Low

---

### User Story

**As a** user with items in my Someday/Maybe list
**I want to** set a "review on" date for specific items
**So that** the system surfaces them at the right time rather than letting them accumulate unseen

---

### Context and Background

**Business Context**
- Business problem: Someday/Maybe is the GTD "incubation" zone. Without review dates, it becomes a graveyard. Items should resurface at the right time (e.g., "Research electric cars — review when spring arrives").
- User pain point: Good ideas buried in Someday/Maybe, never acted upon.
- Expected impact: Someday/Maybe becomes a living list that feeds future commitments, not a dumping ground.

**Technical Context**
- Current system state: `tasks.due_date` column exists. Someday/Maybe tasks have `status = 'someday_maybe'` but `due_date` is not exposed in the UI for this status.
- What changes: Add optional "review on" date to Someday/Maybe processing step and edit menu; surface in the Weekly Review (US-108) and Today view (US-104) when date arrives.
- Related features: US-108 (Weekly Review checks Someday/Maybe), US-104 (Today view).

**Dependencies**

Blocked by: nothing

Blocks: US-108 (Weekly Review step for Someday/Maybe)

---

### Acceptance Criteria

**AC-107-01 — Review date during processing**
- **Given** I route a task to Someday/Maybe during Inbox Processing
- **Then** an optional "Review on" date picker appears alongside the confirmation
- **And** it is clearly optional with placeholder text "Pick a date (optional)"

**AC-107-02 — Review date display in Someday/Maybe list**
- **Given** a Someday/Maybe item has a review date
- **When** I view the Someday/Maybe list
- **Then** the review date is shown in a subtle style (e.g., "Review Mar 30")

**AC-107-03 — Badge on sidebar when review date arrives**
- **Given** a Someday/Maybe item's review date is today or in the past
- **When** I view the sidebar
- **Then** the Someday/Maybe entry shows a notification badge (count of overdue-review items)

**AC-107-04 — Items due for review appear in Today view**
- **Given** a Someday/Maybe item has review_date = today
- **When** I open the Today view (US-104)
- **Then** it appears in a "Review Today" section with a Someday/Maybe label

**AC-107-05 — Edit review date on existing item**
- **Given** a task is already in Someday/Maybe
- **When** I use the task's action menu
- **Then** I can add, change, or clear the review date

---

### Business Impact
- Transforms Someday/Maybe from a passive dump into an active incubation system
- Aligns with GTD tickler principle: "park it until the right time"
- Feeds the Weekly Review's Someday/Maybe step naturally

### Technical Notes
- Reuse `due_date` column for "review on" date on Someday/Maybe items (semantics differ by status, but field is the same)
- Add `due_date` DatePicker to `processToSomedayMaybe` flow in `ProcessingOverlay`
- `SomedayList` component: display date badge, compute overdue-review state
- Sidebar badge: count tasks with `status = 'someday_maybe' AND due_date <= today`

---

---

# EPIC-REVIEW: Weekly Review

---

## US-108 — Guided Weekly Review Workflow

### Story Information
- **Story ID**: US-108
- **Epic**: EPIC-REVIEW — Weekly Review
- **Sprint**: [TBD — Phase 13]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P1-High

---

### User Story

**As a** user who practices GTD
**I want to** be guided through a structured Weekly Review covering all my GTD lists in sequence
**So that** my system stays clean, current, and trusted week after week

---

### Context and Background

**Business Context**
- Business problem: The Weekly Review is the single most important GTD habit, yet it has no structured support in the MVP. Without it, the system degrades: inboxes overflow, lists become stale, commitments are missed.
- User pain point: Users know they should do a Weekly Review but don't know where to start or what order to follow.
- Expected impact: Users who complete a Weekly Review weekly are significantly more likely to maintain and trust their GTD system. This is a key retention driver.

**Technical Context**
- Current system state: No review workflow exists. All lists are independent pages.
- What changes: New `/weekly-review` route with a multi-step guided flow (similar to `ProcessingOverlay` in spirit). Steps:
  1. **Get Clear** — Process everything in Inbox to zero
  2. **Review Waiting For** — Check delegated tasks, note overdue items
  3. **Review Projects** — Confirm each project has a first-step task
  4. **Review Next Actions** — Prune stale items, check contexts
  5. **Review Someday/Maybe** — Act on review-date items, archive or activate
  6. **Done** — Summary screen
- Related features: All EPIC-LISTS views, EPIC-PROJECT, EPIC-TICKLER, EPIC-DELEGATE2.

**Dependencies**

Blocked by: MVP (all list features must exist)

Blocks: US-109 (summary depends on review session data)

---

### Acceptance Criteria

**AC-108-01 — Entry point**
- **Given** I am logged in
- **Then** a "Weekly Review" button appears in the sidebar (distinct from list navigation, e.g., as a CTA or footer link)
- **And** it shows the date of the last completed review (or "Never" if first time)

**AC-108-02 — Step 1: Get Clear (Inbox)**
- **Given** I start the Weekly Review
- **Then** Step 1 shows: Inbox item count + a prompt to process to zero
- **And** a "Open Inbox" shortcut that opens the inbox in a side panel or new tab
- **And** a "Mark inbox as cleared" confirmation to proceed

**AC-108-03 — Step 2: Review Waiting For**
- **Given** I am on Step 2
- **Then** my Waiting For list is displayed in full within the review panel
- **And** for each item I can mark as done, move to Next Actions, or leave as-is
- **And** overdue delegations are highlighted
- **And** a "Looks good" button advances to Step 3

**AC-108-04 — Step 3: Review Projects**
- **Given** I am on Step 3
- **Then** all active projects are listed
- **And** projects without a first-step task are flagged with a warning: "No active next action"
- **And** I can promote a rough-plan item to create a first step without leaving the review
- **And** a "Projects reviewed" button advances to Step 4

**AC-108-05 — Step 4: Review Next Actions**
- **Given** I am on Step 4
- **Then** my Next Actions list is shown grouped by context (if contexts exist)
- **And** I can mark tasks as done or move to Someday/Maybe or Trash
- **And** a "Next Actions reviewed" button advances to Step 5

**AC-108-06 — Step 5: Review Someday/Maybe**
- **Given** I am on Step 5
- **Then** Someday/Maybe items are shown, with review-date-overdue items highlighted first
- **And** I can activate an item (move to Next Actions), archive to Trash, or update the review date
- **And** a "Someday reviewed" button advances to Step 6

**AC-108-07 — Step 6: Done / Summary**
- **Given** I complete all review steps
- **Then** a congratulations screen is shown (see US-109 for summary content)
- **And** the last review date is saved to the user's profile/settings

**AC-108-08 — Progress indicator**
- **Given** I am on any step of the Weekly Review
- **Then** a step progress bar (e.g., "Step 3 of 6") is visible at the top

**AC-108-09 — Exit and resume**
- **Given** I close the Weekly Review mid-flow
- **Then** my progress is NOT saved (review is atomic — complete or restart)
- **And** on re-entry, the review starts from Step 1

---

### Business Impact
- The Weekly Review is the #1 GTD habit that separates casual users from power users
- Implementing it is a major trust-builder and retention driver
- Positions the app as a serious GTD tool, not just a task list

### Technical Notes
- New page: `app/(app)/weekly-review/page.tsx` (or modal overlay)
- Component: `WeeklyReviewFlow` with steps managed by a `currentStep` state
- Each step fetches its own data on mount (server actions or client-side Supabase)
- "Last reviewed" date: store in a `user_preferences` table or `user_integrations` table as a `last_weekly_review` timestamp
- No server-side "review session" model needed for v2.0 — steps are stateless read+act patterns

---

## US-109 — Weekly Review Summary

### Story Information
- **Story ID**: US-109
- **Epic**: EPIC-REVIEW — Weekly Review
- **Sprint**: [TBD — Phase 13]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P2-Medium

---

### User Story

**As a** user completing my Weekly Review
**I want to** see a summary of what I accomplished this week and the current state of my system
**So that** I feel a sense of closure and can start the new week with clarity

---

### Context and Background

**Business Context**
- Business problem: Without a closing summary, the Weekly Review ends abruptly. A summary provides the emotional satisfaction that reinforces the habit.
- User pain point: No sense of progress or accomplishment from the review.
- Expected impact: Higher Weekly Review completion rate; users associate the review with positive feelings → habit reinforcement.

**Technical Context**
- Current system state: No statistics are tracked.
- What changes: At review completion (Step 6), query the DB for the week's stats and display them. Store `last_weekly_review` timestamp.
- Related features: US-108, EPIC-ANALYTICS.

**Dependencies**

Blocked by: US-108

Blocks: nothing

---

### Acceptance Criteria

**AC-109-01 — Stats displayed on completion screen**
- **Given** I complete all 6 steps of the Weekly Review
- **Then** a "Week in Review" summary is shown with:
  - Tasks completed this week (status changed to `done`)
  - Tasks captured to Inbox this week
  - Projects completed this week
  - Open projects count
  - Next Actions count

**AC-109-02 — Last review date saved**
- **Given** I reach Step 6 (the summary screen)
- **Then** the current timestamp is saved as `last_weekly_review`
- **And** the sidebar "Weekly Review" entry now shows "Last reviewed: [date]"

**AC-109-03 — Encouraging empty state**
- **Given** it's the user's first Weekly Review (no historical data)
- **Then** an encouraging message appears: "Your first weekly review — your GTD system is now fully up to date!"

**AC-109-04 — "Close" action**
- **Given** I am on the summary screen
- **When** I click "Close" or "Finish"
- **Then** I am returned to the Inbox page

---

### Business Impact
- Turns the Weekly Review from a chore into a satisfying ritual
- Provides the first metrics data that feeds the Analytics Dashboard (US-111)
- Increases user confidence in their system state

### Technical Notes
- Stats query: count tasks where `updated_at >= (now - 7 days) AND status = 'done'`
- Save `last_weekly_review` to `user_preferences` table (new: `id, user_id, last_weekly_review timestamptz`)
- Or extend `user_integrations` table with the new column if `user_preferences` adds too much schema overhead
- Summary screen: simple stat cards in the glass style

---

---

# EPIC-SEARCH: Full-text Search

---

## US-110 — Full-text Search Across All Lists

### Story Information
- **Story ID**: US-110
- **Epic**: EPIC-SEARCH — Full-text Search
- **Sprint**: [TBD — Phase 14]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P2-Medium

---

### User Story

**As a** user with many tasks and notes
**I want to** search by keyword across all my GTD lists at once
**So that** I can instantly find any item without knowing which list it's in

---

### Context and Background

**Business Context**
- Business problem: A trusted GTD system must be easily retrievable. Without search, users scan lists manually — breaking the "mind like water" state the system is meant to create.
- User pain point: "I captured it somewhere but can't find it" — a direct erosion of system trust.
- Expected impact: Instant retrieval reinforces the habit of capturing everything, because users know they can always find it.

**Technical Context**
- Current system state: No search functionality. Tasks queried by `status` only.
- What changes: Search input in the sidebar header; results page showing matches from `tasks.title`, `tasks.delegated_to`, and `projects.title` across all statuses.
- Supabase offers `ilike` for simple search; `pg_trgm` extension for full-text if needed.
- Related features: All epics (search spans all data).

**Dependencies**

Blocked by: MVP completion

Blocks: nothing

---

### Acceptance Criteria

**AC-110-01 — Search input location**
- **Given** I am on any page in the app
- **Then** a search icon or input field is visible in the sidebar header
- **And** clicking it focuses a search input (keyboard shortcut: `Cmd/Ctrl + K`)

**AC-110-02 — Search results while typing**
- **Given** I type at least 2 characters in the search input
- **Then** results appear within 300ms (debounced)
- **And** results are grouped by type: Tasks, Projects, Notes

**AC-110-03 — Results include all statuses**
- **Given** my search term matches a task in "Someday/Maybe" and a project title
- **Then** both appear in results regardless of their current status or list

**AC-110-04 — Result item display**
- **Given** a result matches a task
- **Then** the result shows: task title (with match highlighted), status badge, due date if set
- **And** clicking the result navigates to the task's list (focused or scrolled to that item)

**AC-110-05 — Empty results state**
- **Given** my search term matches nothing
- **Then** the results area shows: "No results for '[term]'"

**AC-110-06 — Clear search**
- **Given** search results are shown
- **When** I press `Escape` or clear the input
- **Then** results are dismissed and focus returns to the previous view

**AC-110-07 — Trash excluded by default**
- **Given** I search for a term
- **Then** tasks with `status = 'trash'` are excluded from results by default
- **And** a "Include trash" toggle shows items from Trash

---

### Business Impact
- Transforms the app from a structured list tool into a complete personal knowledge system
- Reduces the time to retrieve any captured item to under 3 seconds
- Directly supports the GTD principle: your system must be completely retrievable

### Technical Notes
- Use Supabase `.ilike('title', '%term%')` for v2.0 (simple, no extension needed)
- Search endpoint: client-side Supabase query (no server action needed — read-only)
- Debounce: 250ms before triggering the query
- Result limit: 20 items total (5 per category), with a "See all" link per category
- Command palette style (modal overlay) is preferred over a dedicated results page
- Future: upgrade to Postgres full-text search with `to_tsvector` if needed at scale

---

---

# EPIC-ANALYTICS: Analytics Dashboard

---

## US-111 — Productivity Analytics Dashboard

### Story Information
- **Story ID**: US-111
- **Epic**: EPIC-ANALYTICS — Analytics Dashboard
- **Sprint**: [TBD — Phase 14]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P3-Low

---

### User Story

**As a** user who practices GTD
**I want to** view statistics about my task completion, project velocity, and inbox health over time
**So that** I can identify patterns, celebrate progress, and improve my GTD practice during my Weekly Review

---

### Context and Background

**Business Context**
- Business problem: Users have no visibility into their own productivity trends. Without data, improvements are guesswork.
- User pain point: No sense of momentum or measurable progress; hard to identify GTD bottlenecks (e.g., "Am I capturing more than I'm processing?").
- Expected impact: Users who can see their progress trends are more motivated and better at identifying system weaknesses. Supports the Weekly Review habit.

**Technical Context**
- Current system state: Tasks have `created_at` and `updated_at` timestamps. Status changes are captured implicitly by `updated_at` when status becomes `done`.
- What changes: New `/analytics` route. Server-side aggregation queries grouped by time period (week/month). Charts rendered client-side with a lightweight charting library.
- Note: `updated_at` when `status = 'done'` is used as the completion timestamp. A dedicated `completed_at` column would be more accurate — this can be added as part of this story.
- Related features: US-109 (Weekly Review summary feeds into analytics).

**Dependencies**

Blocked by: MVP (tasks must exist and have timestamps)

Blocks: nothing

---

### Acceptance Criteria

**AC-111-01 — Navigation entry point**
- **Given** I am logged in
- **Then** "Analytics" appears in the sidebar navigation (secondary/footer section)
- **And** it is accessible to all users

**AC-111-02 — Time period selector**
- **Given** I am on the Analytics page
- **Then** a period selector is shown: "Last 7 days", "Last 30 days", "Last 3 months"
- **And** all charts update when I change the period

**AC-111-03 — Inbox health metric**
- **Then** a card shows: "Tasks Captured" (created in Inbox) vs "Tasks Processed" (moved out of Inbox) for the selected period
- **And** a "Capture rate vs. Processing rate" comparison helps identify if Inbox is growing or shrinking

**AC-111-04 — Task completion chart**
- **Then** a bar or area chart shows tasks completed per day/week for the selected period

**AC-111-05 — Average cycle time**
- **Then** a metric card shows: "Average Cycle Time" — average days from task capture (Inbox) to completion (Done)

**AC-111-06 — Project velocity**
- **Then** a card shows: Projects completed in the selected period, Projects created, Active projects count

**AC-111-07 — GTD distribution breakdown**
- **Then** a donut/pie chart shows the current distribution of all tasks by status (Inbox, Next Actions, Waiting For, Someday/Maybe, Calendar, Notes, Trash)
- **And** this represents the user's "system health snapshot"

**AC-111-08 — Recent completions list**
- **Then** a "Recently Completed" list shows the last 10 completed tasks/projects with their completion date

**AC-111-09 — Empty state (new user)**
- **Given** a user has less than 7 days of data
- **Then** an encouraging message appears: "Keep using GTD App — your trends will appear here after a week of activity"

---

### Business Impact
- Enables data-driven self-improvement of GTD practice
- Provides motivational feedback loops (streaks, improvement trends)
- Creates a natural complement to the Weekly Review (US-108)
- Positions the app as a long-term companion, not just a short-term tool

### Technical Notes
- New page: `app/(app)/analytics/page.tsx` (server component for initial data load)
- Add `completed_at timestamptz` column to `tasks` table; populate via DB trigger or server action update when `status = 'done'`
- Queries: aggregated via Supabase — group by date using `date_trunc('day', completed_at)`
- Charting: use `recharts` (lightweight, React-native, no canvas) or CSS-only for simple bar charts
- Chart data serialized to JSON in the server component and passed to client components
- No real-time updates needed — static page refreshed on navigation

---

---

## Document Summary

| Story ID | Title | Epic | Points | Priority |
|----------|-------|------|--------|----------|
| US-101 | Go Back in Processing | EPIC-BACK | 2 | P2 |
| US-102 | Assign Context Tags | EPIC-CONTEXT | 3 | P2 |
| US-103 | Filter by Context | EPIC-CONTEXT | 3 | P2 |
| US-104 | Today Focus View | EPIC-TODAY | 5 | P2 |
| US-105 | Due Date for Delegated Tasks | EPIC-DELEGATE2 | 3 | P2 |
| US-106 | GCal Reminder for Waiting For | EPIC-DELEGATE2 | 5 | P3 |
| US-107 | Someday/Maybe Tickler Date | EPIC-TICKLER | 3 | P3 |
| US-108 | Weekly Review Workflow | EPIC-REVIEW | 8 | P1 |
| US-109 | Weekly Review Summary | EPIC-REVIEW | 5 | P2 |
| US-110 | Full-text Search | EPIC-SEARCH | 5 | P2 |
| US-111 | Analytics Dashboard | EPIC-ANALYTICS | 8 | P3 |

**Total Story Points**: 50
**Recommended Build Order**: US-101 → US-102 → US-103 → US-104 → US-105 → US-107 → US-108 → US-109 → US-110 → US-106 → US-111
