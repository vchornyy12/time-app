# User Stories — GTD App MVP 1.0

## Document Information
- **Product**: GTD App
- **Version**: 1.0 (MVP)
- **Date**: 2026-02-25
- **Source PRD**: `PRD_GTD_App_MVP.md` v1.1
- **Status**: Draft — Backlog

---

## Epic Index

| Epic | ID | Stories | Phase |
|------|----|---------|-------|
| Authentication | EPIC-AUTH | US-001, US-002 | Phase 1 |
| Quick Capture | EPIC-CAPTURE | US-003 | Phase 1 |
| Inbox | EPIC-INBOX | US-004 | Phase 1 |
| Inbox Processing | EPIC-PROCESS | US-005, US-006, US-007 | Phase 2 |
| Task Lists | EPIC-LISTS | US-008, US-009, US-010 | Phase 2 |
| Deadlines | EPIC-DEADLINE | US-011 | Phase 2 |
| Project Management | EPIC-PROJECT | US-012, US-013 | Phase 3 |
| Drag & Drop | EPIC-DND | US-014 | Phase 3 |
| Google Calendar | EPIC-GCAL | US-015, US-016 | Phase 4 |

**Total Story Points (estimate)**: 81

---

---

# EPIC-AUTH: Authentication

---

## US-001 — Email/Password Registration & Login

### Story Information
- **Story ID**: US-001
- **Epic**: EPIC-AUTH — Authentication
- **Related Documents**: PRD `PRD_GTD_App_MVP.md`, Section 4.1 Feature 8, Section 5.4
- **Sprint**: [TBD — Phase 1]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P1-High

---

### User Story

**As a** new or returning user
**I want to** register and log in with my email address and password
**So that** my tasks and projects are private, persisted, and accessible only to me

---

### Context and Background

**Business Context**
- Business problem: Without authentication there is no user isolation or data persistence — the app cannot work as a personal trusted system
- User pain point: Having to re-enter data after each session
- Expected impact: Secure, persistent personal workspace scoped to the authenticated user

**Technical Context**
- Current system state: Fresh Next.js project with no auth wiring
- What changes: Supabase Auth integration; protected routes; session management via JWT
- Related features: All data operations depend on auth.uid() via RLS

**Dependencies**

Blocked by:
- [ ] Supabase project created and environment variables configured

Blocks:
- [ ] All other stories — authentication is a prerequisite for all data operations

---

### Acceptance Criteria

**AC-1: Registration with email/password**
```gherkin
Given I am an unauthenticated user on the registration page
When I enter a valid email and a password (≥ 8 characters) and submit
Then my account is created in Supabase Auth
And I receive a confirmation email
And I am redirected to the app with an active session
```

**AC-2: Email confirmation enforcement**
```gherkin
Given I have registered but not confirmed my email
When I attempt to log in
Then I am shown a message prompting me to confirm my email
And I am not granted access to the app
```

**AC-3: Login with correct credentials**
```gherkin
Given I am a registered and confirmed user
When I enter my correct email and password and submit
Then I am authenticated and redirected to the Inbox view
And my session persists on browser refresh
```

**AC-4: Login with incorrect credentials**
```gherkin
Given I am on the login page
When I enter an incorrect password
Then I see an error message: "Incorrect email or password"
And I am not authenticated
```

**AC-5: Password reset**
```gherkin
Given I am on the login page and have forgotten my password
When I click "Forgot password" and enter my email
Then I receive a password reset email
And following the link allows me to set a new password
```

**AC-6: Route protection**
```gherkin
Given I am an unauthenticated user
When I navigate directly to any protected route (e.g., /inbox)
Then I am redirected to the login page
```

### Non-Functional Criteria

**Security**:
- [ ] Passwords are never stored in plain text (Supabase handles hashing)
- [ ] JWT tokens are stored in httpOnly cookies or Supabase session storage (not localStorage)
- [ ] All auth API calls use HTTPS

**Performance**:
- [ ] Login response time < 1s at p95

**Accessibility**:
- [ ] Login form is fully keyboard navigable
- [ ] Error messages are announced to screen readers via ARIA live regions

---

### Data Model

No new tables. Supabase Auth manages the `auth.users` table. All other tables reference `auth.uid()` via RLS policies.

```sql
-- RLS policy pattern (applied to all user-owned tables)
CREATE POLICY "Users can only access their own data"
ON tasks FOR ALL
USING (auth.uid() = user_id);
```

### Business Logic
- Session auto-refresh via Supabase JS SDK — user stays logged in without manual re-auth
- On account deletion: all user data must be cascade-deleted

---

### UI Description

**Login page layout**:
```
┌─────────────────────────────────────┐
│  [App Logo / Name]                  │
│                                     │
│  [Email input]                      │
│  [Password input]                   │
│  [Login button]                     │
│                                     │
│  Forgot password? | Sign up          │
└─────────────────────────────────────┘
```
- Glassmorphism card centered on a blurred background
- Error states display inline below the relevant field

---

### Definition of Done
- [ ] Implementation matches all acceptance criteria
- [ ] Unit tests for auth helper functions (session check, redirect logic)
- [ ] E2E test: register → confirm → login → see inbox
- [ ] RLS policy test: unauthenticated request returns 0 rows
- [ ] Code reviewed by at least 1 team member
- [ ] No linting errors
- [ ] Deployed to staging and verified

---

---

## US-002 — Google OAuth Sign-In

### Story Information
- **Story ID**: US-002
- **Epic**: EPIC-AUTH — Authentication
- **Related Documents**: PRD Section 4.1 Feature 8
- **Sprint**: [TBD — Phase 1]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P1-High

---

### User Story

**As a** user with a Google account
**I want to** sign in with one click using Google
**So that** I can access the app without managing a separate password

---

### Context and Background

**Technical Context**
- What changes: Enable Google OAuth provider in Supabase Auth; add "Sign in with Google" button to auth pages
- Related features: US-015 (Google Calendar) reuses the same Google OAuth infrastructure but requests different scopes

**Dependencies**

Blocked by:
- [ ] US-001 — auth infrastructure in place
- [ ] Google OAuth app configured in Google Cloud Console with correct redirect URIs

---

### Acceptance Criteria

**AC-1: One-click Google sign-in**
```gherkin
Given I am on the login or registration page
When I click "Sign in with Google"
Then I am redirected to Google's OAuth consent screen
And after granting permission I am redirected back to the app
And I am authenticated with an active session
```

**AC-2: Account creation on first Google login**
```gherkin
Given I have never used the app before
When I sign in with Google for the first time
Then a new user account is created automatically (no separate registration step)
And I am taken directly to the Inbox view
```

**AC-3: Subsequent Google login returns existing account**
```gherkin
Given I have previously signed in with Google
When I sign in with Google again
Then I am authenticated as the same user
And all my previous data is present
```

### Non-Functional Criteria

**Security**:
- [ ] OAuth state parameter validated to prevent CSRF on redirect
- [ ] Scopes requested at this step: email and profile only (calendar scopes deferred to US-015)

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] E2E test: Google OAuth flow completes and user lands on inbox
- [ ] Verified that Google login and email/password login create separate accounts for different emails (no merging without explicit linking)

---

---

# EPIC-CAPTURE: Quick Capture

---

## US-003 — Persistent Quick Capture Input

### Story Information
- **Story ID**: US-003
- **Epic**: EPIC-CAPTURE — Quick Capture
- **Related Documents**: PRD Section 4.1 Feature 1, Section 6.2 Flow 1
- **Sprint**: [TBD — Phase 1]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P0-Critical

---

### User Story

**As a** busy professional in the middle of my workday
**I want to** type any thought into an always-visible input field and press Enter
**So that** it lands in my Inbox instantly without breaking my focus or requiring any categorization

---

### Context and Background

**Business Context**
- User pain point: The moment capture requires navigation or context-switching, users stop using the app
- Expected impact: Zero-friction capture builds the daily habit — the most important behavioral outcome for DAU

**Dependencies**

Blocked by:
- [ ] US-001 — user must be authenticated
- [ ] US-004 — Inbox list must exist to receive captured items

---

### Acceptance Criteria

**AC-1: Capture input is always visible**
```gherkin
Given I am authenticated and on any page of the app
When I view the page
Then a capture input field is visible at the top of the layout
And it is accessible without scrolling
```

**AC-2: Enter key creates inbox item**
```gherkin
Given I have typed text into the capture input
When I press Enter
Then a new task is created with status "inbox"
And it appears at the top of the Inbox list within 500ms (optimistic UI)
And the input field clears immediately
And focus returns to the input field
```

**AC-3: Escape key cancels without creating a task**
```gherkin
Given I have typed text into the capture input
When I press Escape
Then no task is created
And the input field clears
```

**AC-4: Empty input submission is ignored**
```gherkin
Given the capture input is empty
When I press Enter
Then no task is created
And no error message is shown
```

**AC-5: Input length limit**
```gherkin
Given I am typing in the capture input
When I exceed 500 characters
Then additional input is blocked
And a subtle character count indicator is shown
```

### Non-Functional Criteria

**Performance**:
- [ ] Optimistic UI: item appears in Inbox before server confirmation
- [ ] Server round-trip completes within 500ms at p95

**Accessibility**:
- [ ] Input has a visible label or accessible aria-label ("Capture a thought…")
- [ ] Keyboard-only users can reach the input with a single Tab from any page

---

### Data Model

New task created on submit:
```typescript
{
  title: string,          // the typed text
  status: 'inbox',
  user_id: auth.uid(),
  created_at: now(),
  // all other fields: null
}
```

### UI Description
```
┌────────────────────────────────────────────────────────────┐
│  📝 Capture a thought...                          [↩ Enter] │
└────────────────────────────────────────────────────────────┘
```
- Spans full width at the top of the app layout (above navigation content area)
- Liquid Glass styling: frosted panel, subtle placeholder text
- On focus: border glows softly; character count appears in corner if >400 chars

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit test: empty input does not dispatch create action
- [ ] Unit test: input exceeding 500 chars is truncated/blocked
- [ ] E2E test: type text → Enter → item appears in Inbox → input clears
- [ ] Optimistic UI verified: item appears before network response

---

---

# EPIC-INBOX: Inbox

---

## US-004 — Inbox List View & Item Management

### Story Information
- **Story ID**: US-004
- **Epic**: EPIC-INBOX — Inbox
- **Related Documents**: PRD Section 4.1 Feature 2
- **Sprint**: [TBD — Phase 1]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P1-High

---

### User Story

**As a** user who has captured thoughts throughout the day
**I want to** see all my unprocessed inbox items in one list
**So that** I know exactly what needs to be clarified and organized

---

### Acceptance Criteria

**AC-1: Inbox displays all unprocessed items**
```gherkin
Given I am authenticated and have items with status "inbox"
When I navigate to the Inbox view
Then all items with status "inbox" are displayed
And they are ordered newest-first (by created_at descending)
```

**AC-2: Inbox count badge**
```gherkin
Given I have N unprocessed inbox items
When I view any page of the app
Then the navigation shows a badge with the count N next to "Inbox"
And the badge updates in real time when new items are captured
```

**AC-3: Empty state**
```gherkin
Given all inbox items have been processed or deleted
When I view the Inbox
Then I see an empty state message: "Your mind is clear." with a subtle illustration
And no task rows are shown
```

**AC-4: Manual deletion from Inbox**
```gherkin
Given I have an inbox item I want to discard without processing
When I delete it (via delete button or keyboard shortcut)
Then the item is moved to status "trash"
And it disappears from the Inbox immediately
And the count badge decrements by 1
```

**AC-5: Select item to begin processing**
```gherkin
Given I have inbox items
When I click on an item
Then the inbox processing flow opens for that item (US-005)
```

### Non-Functional Criteria

**Performance**:
- [ ] Inbox loads within 300ms for up to 200 items

**Accessibility**:
- [ ] Items are navigable via keyboard (arrow keys or Tab)
- [ ] Badge count changes announced via aria-live region

---

### UI Description
```
┌─────────────────────────────────────┐
│  Inbox (12)                         │
├─────────────────────────────────────┤
│  ○ Buy flight tickets to Berlin  ×  │  ← newest first
│    Added 10 min ago                 │
├─────────────────────────────────────┤
│  ○ Prepare Q2 review slides      ×  │
│    Added 2 hours ago                │
└─────────────────────────────────────┘
```
- Each row: item title + timestamp + delete (×) button on hover
- Click row → opens processing overlay

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Real-time badge update tested (add item via capture → badge increments without page refresh)
- [ ] Deletion moves item to "trash" (not hard delete)

---

---

# EPIC-PROCESS: Inbox Processing

---

## US-005 — Inbox Processing: Steps 1–2 (Actionable? → For Me?)

### Story Information
- **Story ID**: US-005
- **Epic**: EPIC-PROCESS — Inbox Processing
- **Related Documents**: PRD Section 4.1 Feature 3, Section 4.3, Section 6.2 Flow 2
- **Sprint**: [TBD — Phase 2]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P0-Critical

---

### User Story

**As a** user with unprocessed inbox items
**I want to** be guided through the first two GTD decision steps (Actionable? → For Me?)
**So that** I can quickly route non-actionable and delegated items to the correct lists without having to remember the GTD algorithm

---

### Context and Background

**Business Context**
- This is the first half of the GTD "Clarify" step — the core differentiator of this app
- User pain point: Most tools skip this entirely and leave users guessing where to put things

**Dependencies**

Blocked by:
- [ ] US-004 — Inbox list must be functional

Blocks:
- [ ] US-006 — Steps 3–5 depend on the same processing overlay infrastructure

---

### Acceptance Criteria

**AC-1: Open processing flow**
```gherkin
Given I am viewing the Inbox and click on an item
When the processing overlay opens
Then I see the item title prominently displayed
And I see Step 1 prompt: "Is there something to be done with this?"
And I see two buttons: "Yes, it's actionable" and "No, it's not"
And a progress indicator shows "Step 1 of 5"
```

**AC-2: Step 1 — Not Actionable → Trash or Notes choice**
```gherkin
Given I am on Step 1 of processing
When I click "No, it's not actionable"
Then I am shown a secondary prompt: "What is it?"
And I see two buttons: "It's trash — delete it" and "It's reference — save as Note"
```

**AC-2a: Route to Trash**
```gherkin
Given I see the Trash/Notes choice
When I click "It's trash — delete it"
Then the item status is updated to "trash"
And the processing overlay closes with a subtle completion animation
And the item no longer appears in the Inbox
```

**AC-2b: Route to Notes**
```gherkin
Given I see the Trash/Notes choice
When I click "It's reference — save as Note"
Then the item status is updated to "notes"
And the processing overlay closes
And the item appears in the Notes list
```

**AC-3: Step 1 — Actionable → Step 2**
```gherkin
Given I am on Step 1
When I click "Yes, it's actionable"
Then the overlay transitions to Step 2 prompt: "Do I have to do it?"
And I see buttons: "Yes, it's mine" and "No, I'll delegate it"
And the progress indicator updates to "Step 2 of 5"
```

**AC-4: Step 2 — Delegate → Waiting For with delegation details**
```gherkin
Given I am on Step 2
When I click "No, I'll delegate it"
Then I see a form with:
  - delegated_to: text input (required) — "Who is responsible?"
  - due_date: optional date picker — "Deadline (optional)"
Then when I confirm
The item status is set to "waiting_for" with delegated_to, created_at (as delegation date), is_delegation_communicated = false
And the processing overlay closes
```

**AC-5: Step 2 — Mine → Step 3**
```gherkin
Given I am on Step 2
When I click "Yes, it's mine"
Then the overlay transitions to Step 3 (handled by US-006)
```

**AC-6: Cancel at any step**
```gherkin
Given I am at any step in the processing flow
When I click the Cancel / ✕ button
Then the overlay closes
And the item remains in the Inbox with status "inbox"
And no data changes are saved
```

### Non-Functional Criteria

**Performance**:
- [ ] Step transitions are purely client-side: < 150ms

**Accessibility**:
- [ ] Modal overlay traps focus while open
- [ ] Escape key triggers cancel (AC-6)
- [ ] Step buttons are keyboard focusable

---

### Business Logic
- The overlay is a controlled state machine: current step is tracked in local UI state
- Steps cannot be navigated backwards (cancel and restart is the only back path)
- All routing changes are committed to DB only when a terminal step is reached

---

### UI Description
```
┌──────────────────────────────────────────────────────┐
│  ● ● ○ ○ ○   Step 1 of 5                    [Cancel] │
│                                                      │
│  "Buy flight tickets to Berlin"                      │
│                                                      │
│  Is there something to be done with this?            │
│                                                      │
│  [ ✓ Yes, it's actionable ]  [ ✗ No, it's not ]     │
└──────────────────────────────────────────────────────┘
```
- Full-screen overlay with frosted glass panel centered on a dimmed background
- Progress dots at top (filled = completed, current = active, empty = remaining)
- Smooth horizontal slide animation between steps

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit tests: routing functions for each Step 1 and Step 2 branch
- [ ] Unit test: cancel at each step leaves item in "inbox" status
- [ ] E2E test: Step 1 No → Trash path and Step 2 No → Waiting For path (with delegated_to)
- [ ] Delegation form validation: delegated_to required before confirm

---

---

## US-006 — Inbox Processing: Step 3 (Now? → Calendar / Someday/Maybe)

### Story Information
- **Story ID**: US-006
- **Epic**: EPIC-PROCESS — Inbox Processing
- **Related Documents**: PRD Section 4.1 Feature 3
- **Sprint**: [TBD — Phase 2]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P0-Critical

---

### User Story

**As a** user processing an actionable, personal inbox item
**I want to** decide whether it needs to happen soon and if it has a specific date
**So that** time-sensitive tasks land in my Calendar and everything else goes to Someday/Maybe

---

### Dependencies

Blocked by:
- [ ] US-005 — Steps 1–2 processing overlay infrastructure

Blocks:
- [ ] US-007 — Steps 4–5

---

### Acceptance Criteria

**AC-1: Step 3 prompt**
```gherkin
Given the processing flow has passed Steps 1 and 2 (actionable, mine)
When Step 3 is shown
Then I see: "Does it need to happen now? (Today, this week, or soon)"
And I see buttons: "Yes, it's urgent/soon" and "No, not now"
And the progress indicator shows "Step 3 of 5"
```

**AC-2: Step 3 — Not Now with a specific date → Calendar**
```gherkin
Given I am on Step 3 and click "No, not now"
Then I am shown a secondary prompt: "Does it have a specific date?"
When I click "Yes, schedule it" and set a date/time
Then the item status is updated to "calendar" and scheduled_at is set
And the processing overlay closes
And if Google Calendar is connected, the sync flow is triggered (handled by US-016)
```

**AC-3: Step 3 — Not Now without a specific date → Someday/Maybe**
```gherkin
Given I am on Step 3 and click "No, not now"
And I click "No specific date — maybe someday"
Then the item status is updated to "someday_maybe"
And the processing overlay closes
```

**AC-4: Step 3 — Now → Step 4**
```gherkin
Given I am on Step 3
When I click "Yes, it's urgent/soon"
Then the overlay transitions to Step 4 (handled by US-007)
```

---

### Data Model

For Calendar routing:
```typescript
{
  status: 'calendar',
  scheduled_at: Timestamp  // required when routing to Calendar
}
```

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit tests for Calendar and Someday/Maybe routing branches
- [ ] scheduled_at is required when routing to Calendar (form validation)
- [ ] E2E test: Step 3 No → Someday/Maybe path

---

---

## US-007 — Inbox Processing: Steps 4–5 (Single Step? → Project / Next Actions / Do It Now)

### Story Information
- **Story ID**: US-007
- **Epic**: EPIC-PROCESS — Inbox Processing
- **Related Documents**: PRD Section 4.1 Feature 3, Section 4.3
- **Sprint**: [TBD — Phase 2]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P0-Critical

---

### User Story

**As a** user with an actionable, personal, urgent task
**I want to** identify whether it's a single action or a multi-step project, and whether I can do it in 5 minutes
**So that** quick tasks get done immediately, single tasks go to Next Actions, and multi-step work becomes a properly structured Project

---

### Dependencies

Blocked by:
- [ ] US-005 — processing overlay infrastructure
- [ ] US-006 — Step 3 in place

Related to:
- US-012 (Project creation) — Step 4 "No" branch triggers project creation

---

### Acceptance Criteria

**AC-1: Step 4 prompt**
```gherkin
Given the processing flow has passed Steps 1–3
When Step 4 is shown
Then I see: "Is this a single-step task?"
And I see buttons: "Yes, one action" and "No, it's multi-step"
And the progress indicator shows "Step 4 of 5"
```

**AC-2: Step 4 — Multi-step → Project creation form**
```gherkin
Given I am on Step 4 and click "No, it's multi-step"
Then the overlay transitions to a Project creation form (US-012)
And the original inbox item text pre-fills the project title field
```

**AC-3: Step 4 — Single step → Step 5**
```gherkin
Given I am on Step 4 and click "Yes, one action"
Then the overlay transitions to Step 5: "Can it be done in 5 minutes?"
And I see buttons: "Yes — do it now!" and "No — add to Next Actions"
And the progress indicator shows "Step 5 of 5"
```

**AC-4: Step 5 — Do it now (≤ 5 min)**
```gherkin
Given I am on Step 5 and click "Yes — do it now!"
Then the item status is set to "done"
And the processing overlay closes with a satisfying completion animation
And the item does not appear in any active list
And the Inbox count decrements
```

**AC-5: Step 5 — Add to Next Actions (> 5 min)**
```gherkin
Given I am on Step 5 and click "No — add to Next Actions"
Then the item status is set to "next_actions"
And the processing overlay closes
And the item appears in the Next Actions list
And the Inbox count decrements
```

### Business Logic
- "Do it now" path sets status to "done" immediately — no confirmation required
- Items routed to "done" via this path have no due_date; they are considered completed at routing time (updated_at = completion timestamp)
- The project creation form branch (AC-2) is a full sub-flow covered in US-012

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit tests: all terminal routing outcomes (done, next_actions, project branch)
- [ ] E2E test: complete 5-step happy path (Yes → Yes → Yes → Yes → No) → item in Next Actions
- [ ] E2E test: Yes → Yes → Yes → Yes → Yes (Do it now) → item in "done", not in any active list

---

---

# EPIC-LISTS: Task Lists

---

## US-008 — Next Actions List with Context Filtering

### Story Information
- **Story ID**: US-008
- **Epic**: EPIC-LISTS — Task Lists
- **Related Documents**: PRD Section 4.1 Feature 4, Section 4.3
- **Sprint**: [TBD — Phase 2]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P1-High

---

### User Story

**As a** user ready to work
**I want to** see all my Next Actions and filter them by context (e.g., @Phone, @Computer, @Errands)
**So that** I only see tasks relevant to what I can do right now given my location and available tools

---

### Context and Background

**Business Context**
- GTD contexts are essential for matching tasks to the user's current situation — a key differentiator from generic to-do apps
- User pain point: Seeing @Computer tasks while commuting is distracting and demotivating

**Dependencies**

Blocked by:
- [ ] US-007 — items must exist in "next_actions" status before this list is useful

---

### Acceptance Criteria

**AC-1: Next Actions list shows all relevant tasks**
```gherkin
Given I have tasks with status "next_actions"
When I navigate to the Next Actions view
Then all such tasks are displayed
And tasks with a due_date show the date visually
And overdue tasks (due_date < today) are highlighted (e.g., red badge)
```

**AC-2: Assign context(s) to a task**
```gherkin
Given I am viewing a task in Next Actions
When I open the task's detail/edit inline panel
Then I can type or select one or more context tags (e.g., "@Phone", "@Computer")
And the contexts are saved to the task's contexts array
```

**AC-3: Filter by context**
```gherkin
Given I have tasks with and without contexts
When I select a context filter (e.g., "@Phone")
Then only tasks that include "@Phone" in their contexts array are shown
And tasks with no context assigned are always shown regardless of the active filter
```

**AC-4: Multiple context filters**
```gherkin
Given I have selected two context filters (@Phone and @Computer)
When the list renders
Then tasks matching either @Phone or @Computer are shown (OR logic)
```

**AC-5: Clear context filter**
```gherkin
Given I have an active context filter
When I click "Clear filter" or deselect the context chip
Then all Next Actions items are shown again
```

**AC-6: Mark task as complete**
```gherkin
Given I have completed a Next Actions task in real life
When I check the task's completion checkbox
Then its status is updated to "done"
And it disappears from the Next Actions list
```

### Non-Functional Criteria

**Performance**:
- [ ] Filter operation is client-side (no extra DB query needed — contexts are already loaded)
- [ ] List renders within 200ms for up to 200 items

---

### Data Model

```typescript
// Contexts stored as an array of strings on the task record
contexts: string[] | null  // e.g., ["@Phone", "@Computer"]
```

```sql
-- Index for future filtering efficiency
CREATE INDEX idx_tasks_contexts ON tasks USING GIN(contexts);
```

### Business Logic
- Context filter uses OR logic: a task matches if its contexts array contains ANY of the selected filters
- Tasks with `contexts = null` or `contexts = []` always pass any context filter (they are context-agnostic)

---

### UI Description
```
┌─────────────────────────────────────────────────────┐
│  Next Actions (8)                                   │
│  Filter: [@Phone] [@Computer] [@Errands] [+ Add]   │
├─────────────────────────────────────────────────────┤
│  ○ Call dentist to reschedule        @Phone  ×  🔴  │  ← overdue
│  ○ Write Q2 proposal intro           @Computer     │
│  ○ Pick up dry cleaning              @Errands       │
│  ○ Review Sam's pull request         @Computer      │
└─────────────────────────────────────────────────────┘
```
- Active context filter chips highlighted; inactive = dimmed
- Overdue indicator: red dot or badge on due_date

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit test: context filter logic (OR matching, null contexts always visible)
- [ ] E2E test: add task with @Phone context → filter by @Phone → task visible; filter by @Computer → task hidden (but null-context task visible)
- [ ] Overdue highlighting verified

---

---

## US-009 — Waiting For List with Delegation Tracking

### Story Information
- **Story ID**: US-009
- **Epic**: EPIC-LISTS — Task Lists
- **Related Documents**: PRD Section 4.1 Feature 4, Section 4.3
- **Sprint**: [TBD — Phase 2]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P1-High

---

### User Story

**As a** user who has delegated tasks to others
**I want to** see a clear list of what I'm waiting for, who I delegated to, when it's due, and whether I actually communicated the request
**So that** I can follow up on commitments and distinguish tasks I've "recorded" from tasks I've "actually handed off"

---

### Dependencies

Blocked by:
- [ ] US-005 — items are routed to "waiting_for" via inbox processing Step 2

---

### Acceptance Criteria

**AC-1: Waiting For list displays all delegated tasks**
```gherkin
Given I have tasks with status "waiting_for"
When I navigate to the Waiting For view
Then all such tasks are shown with columns:
  - Task title
  - delegated_to (who it's assigned to)
  - delegated on (created_at date)
  - due_date (if set)
  - is_delegation_communicated toggle
```

**AC-2: Visual distinction for uncommunicated delegations**
```gherkin
Given a task has is_delegation_communicated = false
When I view the Waiting For list
Then the task row is visually flagged (e.g., orange indicator or "Not yet communicated" label)
```

**AC-3: Mark delegation as communicated**
```gherkin
Given a task has is_delegation_communicated = false
When I click/toggle the communication checkbox on that task
Then is_delegation_communicated is set to true
And the visual flag is removed
```

**AC-4: Edit delegation details inline**
```gherkin
Given I view a Waiting For item
When I click to edit it
Then I can update: delegated_to, due_date, is_delegation_communicated
And changes are saved on blur/confirm
```

**AC-5: Mark a Waiting For item as received/complete**
```gherkin
Given the delegated work has been completed
When I check the task's completion checkbox
Then its status is updated to "done"
And it disappears from the Waiting For list
```

---

### Business Logic
- `is_delegation_communicated = false` = user added it to Waiting For in the app but hasn't yet sent the email/message/made the call
- `is_delegation_communicated = true` = user has confirmed in the real world that the request was communicated
- Setting `is_delegation_communicated` is never automatic — it requires explicit user action

---

### UI Description
```
┌─────────────────────────────────────────────────────────────────┐
│  Waiting For (4)                                                │
├──────────────────────┬──────────────┬────────────┬─────────────┤
│  Task                │ Delegated To │  Due Date  │ Communicated│
├──────────────────────┼──────────────┼────────────┼─────────────┤
│  Review contract     │ Max (Legal)  │ Mar 5      │  ✓          │
│  Send design brief   │ Ana          │ —          │  ⚠ [toggle] │ ← not communicated
└──────────────────────┴──────────────┴────────────┴─────────────┘
```

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit test: toggle is_delegation_communicated updates DB correctly
- [ ] Visual flag for uncommunicated items verified in manual test
- [ ] Overdue Waiting For items (past due_date) highlighted

---

---

## US-010 — Someday/Maybe, Notes & Trash Lists

### Story Information
- **Story ID**: US-010
- **Epic**: EPIC-LISTS — Task Lists
- **Related Documents**: PRD Section 4.1 Feature 4
- **Sprint**: [TBD — Phase 2]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P2-Medium

---

### User Story

**As a** user who has processed inbox items into deferred, reference, or deleted categories
**I want to** browse Someday/Maybe ideas, review reference Notes, and manage my Trash
**So that** I have a complete view of every item I've processed and can act on deferred ideas when the time is right

---

### Dependencies

Blocked by:
- [ ] US-005, US-006 — items routed to these lists during processing

---

### Acceptance Criteria

**AC-1: Someday/Maybe list**
```gherkin
Given tasks exist with status "someday_maybe"
When I navigate to Someday/Maybe
Then all such tasks are shown, ordered by created_at descending
And I can move any item to "next_actions" via a "Activate" button
And I can delete any item (moves to trash)
```

**AC-2: Notes list (reference material)**
```gherkin
Given tasks exist with status "notes"
When I navigate to Notes
Then all reference items are shown
And I cannot mark Notes as "complete" (they are reference, not actions)
And I can delete a note (moves to trash)
```

**AC-3: Trash list**
```gherkin
Given tasks exist with status "trash"
When I navigate to Trash
Then all trashed items are shown
And I see an "Empty Trash" button
When I click "Empty Trash" and confirm the prompt
Then all trash items are permanently deleted (hard delete)
```

**AC-4: Restore from Trash**
```gherkin
Given I have an item in Trash I want to recover
When I click "Restore" on that item
Then its status returns to "inbox"
And it appears in the Inbox for re-processing
```

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] "Empty Trash" requires a confirmation dialog before hard-deleting
- [ ] Hard delete verified: records are removed from DB, not soft-deleted again

---

---

# EPIC-DEADLINE: Deadlines

---

## US-011 — Assign Due Dates to Tasks

### Story Information
- **Story ID**: US-011
- **Epic**: EPIC-DEADLINE — Deadlines
- **Related Documents**: PRD Section 4.1 Feature 4, Section 4.3, Section 4.4
- **Sprint**: [TBD — Phase 2]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 3
- **Priority**: P1-High

---

### User Story

**As a** user managing tasks with external commitments
**I want to** assign a hard deadline (due_date) to any active task
**So that** I can track when work must be completed and see which tasks are at risk of being late

---

### Dependencies

Blocked by:
- [ ] US-008 — Next Actions list must exist to display due dates

---

### Acceptance Criteria

**AC-1: Set due_date on any active task**
```gherkin
Given I am viewing any active task (Next Actions, Waiting For, or a Project's first step)
When I open the task's inline edit panel
Then I see an optional "Due date" date picker field
When I select a date
Then due_date is saved on the task record
```

**AC-2: Remove due_date**
```gherkin
Given a task has a due_date set
When I open the task's inline edit panel and clear the due date
Then due_date is set to null
And no deadline indicator appears on the task
```

**AC-3: Overdue visual indicator**
```gherkin
Given a task has a due_date that is in the past
When I view it in any list
Then it is visually highlighted as overdue (red badge, color, or icon)
```

**AC-4: Upcoming deadline indicator**
```gherkin
Given a task has a due_date within the next 48 hours
When I view it in any list
Then it is visually flagged as "due soon" (e.g., amber/yellow indicator)
```

### Business Logic
- `due_date` vs `scheduled_at`: `due_date` = when the task MUST be done (external commitment); `scheduled_at` = when it is SCHEDULED on Google Calendar. A task can have both, one, or neither.
- Overdue threshold: `due_date < start of today` (not just < now, to avoid tasks becoming overdue mid-day)

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit test: overdue logic (due_date before today = overdue; today = not overdue)
- [ ] Unit test: "due soon" logic (within 48h window)

---

---

# EPIC-PROJECT: Project Management

---

## US-012 — Create a Project from Inbox Processing

### Story Information
- **Story ID**: US-012
- **Epic**: EPIC-PROJECT — Project Management
- **Related Documents**: PRD Section 4.1 Feature 5, Section 4.3, Section 6.2 Flow 3
- **Sprint**: [TBD — Phase 3]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P0-Critical

---

### User Story

**As a** user who realizes an inbox item requires multiple steps
**I want to** create a structured Project with a completion goal, a rough plan, and a first step — all from within the inbox processing flow
**So that** multi-step work is never lost in an ambiguous to-do and always has a clear next action

---

### Dependencies

Blocked by:
- [ ] US-007 — Project creation is triggered from inbox processing Step 4 "No" branch

Related to:
- US-013 — this story creates the project; US-013 is the day-to-day management view

---

### Acceptance Criteria

**AC-1: Project creation form appears from Step 4**
```gherkin
Given I am on Step 4 of inbox processing and click "No, it's multi-step"
When the project creation form opens
Then the original inbox item text is pre-filled in the "Project Title" field
And I see required fields: Title, Completion Criteria, Rough Plan, First Step
And I see a "Create Project" confirm button
```

**AC-2: All required fields enforced**
```gherkin
Given I am on the project creation form
When I attempt to submit with any required field empty
Then submission is blocked
And the empty field is highlighted with an inline error message
```

**AC-3: Rough plan accepts multiple items**
```gherkin
Given I am filling in the project creation form
When I type in the Rough Plan field and press Enter
Then a new plan line is added (multi-line ordered list)
And items can be reordered via drag handle in the form
```

**AC-4: Project is created on confirm**
```gherkin
Given I have filled in all required fields
When I click "Create Project"
Then a new Project record is created with status "active"
Then the First Step text is created as a separate task with status "next_actions" linked to the project via project_id
And the original inbox item is archived (status set to "done" or a "converted" marker)
And the processing overlay closes
```

**AC-5: First step appears in Next Actions with project label**
```gherkin
Given a project has been created via inbox processing
When I navigate to Next Actions
Then the project's first step is visible
And it is labeled with the project title (e.g., a small badge: "[Project Name]")
```

### Data Model

```typescript
// Project record
interface Project {
  id: string;
  title: string;
  completion_criteria: string;      // required
  rough_plan: RoughPlanItem[];      // ordered JSON array
  first_step_task_id: string;       // FK to tasks
  status: 'active' | 'completed';
  user_id: string;
  created_at: Date;
  updated_at: Date;
}

interface RoughPlanItem {
  id: string;           // local UUID for reordering
  text: string;
  order: number;
}
```

```sql
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  completion_criteria TEXT NOT NULL,
  rough_plan JSONB NOT NULL DEFAULT '[]',
  first_step_task_id UUID REFERENCES tasks(id),
  status TEXT NOT NULL DEFAULT 'active',
  user_id UUID NOT NULL REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE tasks ADD COLUMN project_id UUID REFERENCES projects(id);
```

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit tests: project creation with all required fields; missing field validation
- [ ] Integration test: creating a project creates both the project record and the first_step task record in a single transaction (no partial state)
- [ ] E2E test: inbox processing → Step 4 No → fill project form → confirm → first step visible in Next Actions with project badge

---

---

## US-013 — Project Detail View & Rough Plan Management

### Story Information
- **Story ID**: US-013
- **Epic**: EPIC-PROJECT — Project Management
- **Related Documents**: PRD Section 4.1 Feature 5, Section 6.2 Flow 4
- **Sprint**: [TBD — Phase 3]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P1-High

---

### User Story

**As a** user managing ongoing projects
**I want to** open a project and see its completion criteria, rough plan, and active first step — and get prompted to advance when the first step is complete
**So that** I always know what the next concrete action is for any project

---

### Dependencies

Blocked by:
- [ ] US-012 — projects must be creatable before they can be managed

Related to:
- US-014 — DnD promotion is the primary interaction on this view

---

### Acceptance Criteria

**AC-1: Projects list view**
```gherkin
Given I have one or more active projects
When I navigate to the Projects view
Then each project is shown with: title, active first step title, remaining plan items count, status
```

**AC-2: Project detail view**
```gherkin
Given I click on a project in the list
When the project detail view opens
Then I see:
  - Project title and completion criteria
  - Active first step (highlighted/prominent, shows as a full task)
  - Rough plan list (remaining steps below the active step)
  - A "Mark project complete" button
```

**AC-3: First step completion triggers nudge**
```gherkin
Given I view the project detail and the first step is the active task
When I mark the first step as complete (checkbox)
Then the first step disappears from the active zone
And a contextual prompt appears: "What's next for [Project Name]? Drag the next step up."
```

**AC-4: Mark project as complete**
```gherkin
Given all steps of a project are done
When I click "Mark project complete"
Then the project status is set to "completed"
And it no longer appears in the active Projects list
And it is accessible in a "Completed Projects" archive view
```

**AC-5: Edit project title and completion criteria**
```gherkin
Given I am on the project detail view
When I click on the title or completion criteria
Then an inline edit field appears
And changes are saved on blur
```

---

### UI Description
```
┌──────────────────────────────────────────────────────────┐
│  ← Projects    Launch Marketing Campaign                 │
│                                                          │
│  Goal: Campaign is live, first 100 sign-ups received    │
│                                                          │
│  ▶ ACTIVE FIRST STEP                                     │
│  ┌────────────────────────────────────────────────────┐  │
│  │  ○  Draft the landing page copy        @Computer  │  │
│  └────────────────────────────────────────────────────┘  │
│                                                          │
│  ROUGH PLAN (4 remaining)                                │
│  ⠿  Design hero section in Figma                         │
│  ⠿  Set up analytics tracking                            │
│  ⠿  Write email sequence                                 │
│  ⠿  Schedule launch post                                 │
│                                                          │
│                    [Mark Project Complete]               │
└──────────────────────────────────────────────────────────┘
```

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Completing the first step triggers the nudge prompt (not an automatic promotion)
- [ ] Completed projects are accessible in an archive view

---

---

# EPIC-DND: Drag & Drop

---

## US-014 — Promote Next Step via Drag & Drop

### Story Information
- **Story ID**: US-014
- **Epic**: EPIC-DND — Drag & Drop
- **Related Documents**: PRD Section 4.1 Feature 6, Section 4.3, Section 6.2 Flow 4
- **Sprint**: [TBD — Phase 3]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P1-High

---

### User Story

**As a** user who has just completed a project's first step
**I want to** drag the next item from the rough plan into the Active Task zone
**So that** it becomes the new first step — a full task with Next Actions status — and I always have one clear next action for every project

---

### Context and Background

**Technical Context**
- Library: dnd-kit recommended (accessibility-first, React 19 compatible, no jQuery dependency)
- The rough plan list items are draggable sources; the Active Task zone is the drop target

**Dependencies**

Blocked by:
- [ ] US-013 — project detail view must be in place

---

### Acceptance Criteria

**AC-1: Drag handles visible on hover**
```gherkin
Given I am viewing the project detail view's rough plan
When I hover over a rough plan item
Then a drag handle icon (⠿) appears on the left side of the item
```

**AC-2: Drop zone activation during drag**
```gherkin
Given I am dragging a rough plan item
When I move it toward the Active Task zone
Then the Active Task zone visually highlights (glows or changes background)
And a ghost/preview of the item follows my cursor
```

**AC-3: Successful drop promotes item to active task**
```gherkin
Given I am dragging a rough plan item over the Active Task zone
When I release/drop it
Then the item is removed from the rough plan list
And a new task is created with:
  - title = the rough plan item text
  - status = "next_actions"
  - project_id = the current project
And the project's first_step_task_id is updated to point to the new task
And the new task appears in the Next Actions list with the project label
```

**AC-4: Rough plan reordering (within the plan list)**
```gherkin
Given I am viewing the rough plan
When I drag an item to a different position within the rough plan list
Then the rough_plan array order is updated accordingly
And the visual order reflects the new arrangement
```

**AC-5: Drop outside valid zone cancels drag**
```gherkin
Given I am dragging a rough plan item
When I release it outside the Active Task zone and outside the rough plan list
Then the item returns to its original position with an animation
And no data changes are made
```

**AC-6: Keyboard-accessible alternative**
```gherkin
Given I am focused on a rough plan item
When I press Space to pick it up and use Arrow keys to move it
Then keyboard-driven reordering and promotion work identically to mouse drag
```

### Non-Functional Criteria

**Performance**:
- [ ] Drag animations maintain ≥ 60 fps
- [ ] No layout thrashing during drag (use CSS transform, not top/left)

**Accessibility**:
- [ ] ARIA roles: listitem for plan items, combobox/listbox pattern or custom ARIA for DnD
- [ ] Screen reader announces item grabbed, current position, and drop confirmation

---

### Business Logic
- Only one item can be in the Active Task zone at a time (the first step)
- Dropping on the Active Task zone when there is already an active first step: the existing first step is demoted back to the rough plan (prepended at position 0) and the dropped item becomes the new first step
- Dropping within the rough plan list only reorders — it does not promote to active task

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit test: rough_plan JSON array reordering logic
- [ ] Unit test: promotion creates correct task record and updates first_step_task_id
- [ ] E2E test: drag plan item to Active Task zone → item appears in Next Actions → rough plan count decrements
- [ ] Keyboard alternative (AC-6) verified with screen reader
- [ ] Drag at 60fps verified on a mid-range laptop

---

---

# EPIC-GCAL: Google Calendar

---

## US-015 — Connect Google Calendar via OAuth

### Story Information
- **Story ID**: US-015
- **Epic**: EPIC-GCAL — Google Calendar
- **Related Documents**: PRD Section 4.1 Feature 7, Section 5.5
- **Sprint**: [TBD — Phase 4]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 5
- **Priority**: P1-High

---

### User Story

**As a** user who wants time-specific tasks to appear in my calendar
**I want to** connect my Google Calendar with a single OAuth flow
**So that** the app can create and update calendar events on my behalf without me switching between apps

---

### Context and Background

**Technical Context**
- OAuth 2.0 authorization code flow with `offline` access (to obtain a refresh token)
- Scopes: `https://www.googleapis.com/auth/calendar.events` (create/update/delete events only)
- Refresh token stored encrypted in Supabase (associated with the user record)
- This is a separate OAuth grant from US-002 (Google Sign-In uses different scopes)

**Dependencies**

Blocked by:
- [ ] US-001 or US-002 — user must be authenticated
- [ ] Google Cloud Console OAuth app configured with Calendar API enabled

Related to:
- US-016 — calendar sync uses the connection established here

---

### Acceptance Criteria

**AC-1: Connect Google Calendar from Settings**
```gherkin
Given I am an authenticated user
When I navigate to Settings → Integrations
Then I see a "Connect Google Calendar" button with a description of what access is requested
```

**AC-2: OAuth authorization flow**
```gherkin
Given I click "Connect Google Calendar"
When I am redirected to Google's OAuth consent screen
Then the app requests only calendar.events scope
And after I grant permission I am redirected back to the app
And a success message confirms "Google Calendar connected"
```

**AC-3: Connection persists across sessions**
```gherkin
Given I have connected Google Calendar
When I log out and log back in
Then Google Calendar remains connected (refresh token persists)
And no re-authorization is required
```

**AC-4: Disconnect Google Calendar**
```gherkin
Given I have connected Google Calendar
When I click "Disconnect" in Settings
Then the refresh token is revoked and deleted
And future tasks will not be synced
And a message confirms: "Google Calendar disconnected. Existing events are not deleted."
```

**AC-5: First-time Calendar task triggers connection prompt**
```gherkin
Given I have not connected Google Calendar
When a task is routed to "calendar" during inbox processing
Then after the date/time picker, a prompt appears: "Connect Google Calendar to sync this event"
And I can initiate the OAuth flow inline
```

### Non-Functional Criteria

**Security**:
- [ ] Refresh token is stored encrypted in the database (not in browser storage)
- [ ] Only `calendar.events` scope granted — no access to contacts, Gmail, etc.
- [ ] OAuth state parameter validated on redirect to prevent CSRF

---

### Data Model

```sql
-- Store per-user Google Calendar OAuth tokens
CREATE TABLE user_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  provider TEXT NOT NULL DEFAULT 'google_calendar',
  access_token TEXT,              -- encrypted
  refresh_token TEXT,             -- encrypted
  token_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Refresh token stored encrypted (not plaintext) — verify in DB directly
- [ ] Token refresh logic tested: expired access token is refreshed automatically using refresh token
- [ ] Disconnect revokes token with Google AND deletes from DB

---

---

## US-016 — Sync Calendar Tasks as Google Calendar Events

### Story Information
- **Story ID**: US-016
- **Epic**: EPIC-GCAL — Google Calendar
- **Related Documents**: PRD Section 4.1 Feature 7, Section 5.5
- **Sprint**: [TBD — Phase 4]
- **Assignee**: [TBD]
- **Status**: Backlog
- **Story Points**: 8
- **Priority**: P1-High

---

### User Story

**As a** user with Google Calendar connected
**I want to** have tasks routed to "Calendar" automatically appear as events in Google Calendar
**So that** I have a single, unified view of my scheduled commitments without manual duplication

---

### Dependencies

Blocked by:
- [ ] US-015 — Google Calendar must be connected
- [ ] US-006 — tasks are routed to "calendar" status during inbox processing Step 3

---

### Acceptance Criteria

**AC-1: Task routed to Calendar creates a Google Calendar event**
```gherkin
Given my Google Calendar is connected
When I route an inbox item to "calendar" during processing and set a scheduled_at date/time
Then a new event is created in my Google Calendar via the API
And the event title = the task title
And the event time = scheduled_at
And the google_calendar_event_id is saved on the task record
And the in-app Calendar list shows the task with its scheduled_at date/time
```

**AC-2: Updating scheduled_at updates the Google Calendar event**
```gherkin
Given a Calendar task has a google_calendar_event_id
When I change the task's scheduled_at in the app
Then the corresponding Google Calendar event is updated via the API
And the event time reflects the new scheduled_at
```

**AC-3: Deleting/trashing a Calendar task removes the Google Calendar event**
```gherkin
Given a Calendar task has a google_calendar_event_id
When I move the task to Trash
Then the corresponding Google Calendar event is deleted via the API
And google_calendar_event_id is cleared on the task record
```

**AC-4: Google Calendar not connected — graceful degradation**
```gherkin
Given my Google Calendar is NOT connected
When I route a task to "calendar" and set a scheduled_at
Then the task is saved as status "calendar" with the scheduled_at date
And no Google Calendar event is created
And an in-app message notes: "Connect Google Calendar to sync this event"
```

**AC-5: API error handling**
```gherkin
Given Google Calendar API returns an error during event creation
When the error occurs
Then the task is still saved locally with status "calendar"
And a notification is shown: "Could not sync to Google Calendar — check your connection"
And a retry option is available
```

### Non-Functional Criteria

**Performance**:
- [ ] Google Calendar API call happens asynchronously (non-blocking to UI)
- [ ] Calendar event should appear in Google Calendar within 5 seconds of routing

**Security**:
- [ ] API calls use the user's own OAuth access token — never a shared/service account token
- [ ] Access token refreshed automatically before expiry using the stored refresh token

---

### Data Model

```typescript
// task record update after Calendar routing
{
  status: 'calendar',
  scheduled_at: Timestamp,
  google_calendar_event_id: string  // set after successful API call
}
```

### Business Logic
- Create event: `POST https://www.googleapis.com/calendar/v3/calendars/primary/events`
- Update event: `PATCH https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}`
- Delete event: `DELETE https://www.googleapis.com/calendar/v3/calendars/primary/events/{eventId}`
- If `google_calendar_event_id` is null (sync never completed), a "Re-sync" action should be available

### Error Handling
| Error Condition | User Message | System Action |
|-----------------|--------------|---------------|
| 401 Unauthorized | "Google Calendar session expired — reconnect" | Attempt token refresh; if failed, prompt reconnect |
| 403 Forbidden | "Google Calendar permission denied" | Show reconnect prompt |
| 429 Rate Limited | "Google Calendar sync delayed" | Retry with exponential backoff |
| Network Error | "Could not sync to Google Calendar" | Store event locally; retry once connectivity resumes |

---

### Definition of Done
- [ ] All acceptance criteria met
- [ ] Unit tests: event payload construction (title, time format, timezone)
- [ ] Integration test: mock Google Calendar API — verify correct endpoints called on create/update/delete
- [ ] E2E test: route task to Calendar → verify event appears in Google Calendar (requires live test account)
- [ ] Error path (AC-5) tested: API failure leaves task saved locally with notification
- [ ] Token refresh path tested: expired access token is refreshed and call retried automatically

---

---

## Appendix: Story Summary

| Story ID | Title | Epic | Points | Priority | Phase |
|----------|-------|------|--------|----------|-------|
| US-001 | Email/Password Registration & Login | AUTH | 5 | P1 | 1 |
| US-002 | Google OAuth Sign-In | AUTH | 3 | P1 | 1 |
| US-003 | Persistent Quick Capture Input | CAPTURE | 3 | P0 | 1 |
| US-004 | Inbox List View & Item Management | INBOX | 3 | P1 | 1 |
| US-005 | Inbox Processing: Steps 1–2 | PROCESS | 5 | P0 | 2 |
| US-006 | Inbox Processing: Step 3 | PROCESS | 5 | P0 | 2 |
| US-007 | Inbox Processing: Steps 4–5 | PROCESS | 8 | P0 | 2 |
| US-008 | Next Actions List with Context Filtering | LISTS | 8 | P1 | 2 |
| US-009 | Waiting For List with Delegation Tracking | LISTS | 5 | P1 | 2 |
| US-010 | Someday/Maybe, Notes & Trash Lists | LISTS | 5 | P2 | 2 |
| US-011 | Assign Due Dates to Tasks | DEADLINE | 3 | P1 | 2 |
| US-012 | Create a Project from Inbox Processing | PROJECT | 8 | P0 | 3 |
| US-013 | Project Detail View & Rough Plan Management | PROJECT | 5 | P1 | 3 |
| US-014 | Promote Next Step via Drag & Drop | DND | 8 | P1 | 3 |
| US-015 | Connect Google Calendar via OAuth | GCAL | 5 | P1 | 4 |
| US-016 | Sync Calendar Tasks as Google Calendar Events | GCAL | 8 | P1 | 4 |
| **TOTAL** | | | **81** | | |
