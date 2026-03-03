# GTD App — Implementation Plan & Checklist

**Stack**: Next.js 16 · React 19 · TypeScript 5 · Tailwind CSS 4 · Supabase · dnd-kit · Google Calendar API
**Starting point**: Empty Next.js 16 App Router scaffold
**Date**: 2026-02-25

---

## Phase 1 — Foundation (Week 1–2)

### 1.1 Project Setup & Dependencies
- [ ] Install core dependencies:
  - `@supabase/supabase-js` `@supabase/ssr`
  - `dnd-kit` (`@dnd-kit/core` `@dnd-kit/sortable` `@dnd-kit/utilities`)
  - `zod` (schema validation)
  - `date-fns` (date formatting)
  - `lucide-react` (icons)
- [ ] Create `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] Set up Supabase project (free tier) at supabase.com
- [ ] Configure `next.config.ts` (image domains, etc.)
- [ ] Set up path aliases in `tsconfig.json` (`@/` → `./`)
- [ ] Define folder structure:
  ```
  app/
    (auth)/login/  (auth)/register/
    (app)/inbox/  (app)/next-actions/  (app)/waiting-for/
    (app)/someday/  (app)/notes/  (app)/trash/  (app)/projects/
    api/
  components/ui/  components/layout/  components/tasks/  components/projects/
  lib/supabase/  lib/hooks/  lib/types/  lib/utils/
  ```

### 1.2 Database Schema (Supabase SQL Editor)
- [ ] Create `tasks` table:
  ```sql
  id, title, status, user_id, project_id, created_at, updated_at,
  scheduled_at, due_date, delegated_to, is_delegation_communicated,
  google_calendar_event_id, contexts[]
  ```
- [ ] Create `projects` table:
  ```sql
  id, title, completion_criteria, rough_plan (jsonb[]),
  first_step_task_id, status, user_id, created_at, updated_at
  ```
- [ ] Create `user_integrations` table:
  ```sql
  id, user_id, google_refresh_token, google_calendar_id, created_at
  ```
- [ ] Enable Row Level Security (RLS) on all tables
- [ ] Write RLS policies — `user_id = auth.uid()` for SELECT/INSERT/UPDATE/DELETE
- [ ] Create DB indexes: `tasks(user_id, status)`, `tasks(project_id)`, `projects(user_id)`
- [ ] Test RLS with two test users (verify cross-user isolation)

### 1.3 Supabase Client Setup
- [ ] Create `lib/supabase/client.ts` — browser client (singleton)
- [ ] Create `lib/supabase/server.ts` — server client (cookies-based for Server Components)
- [ ] Create `lib/supabase/middleware.ts` — session refresh logic
- [ ] Add `middleware.ts` at project root — protect `(app)` routes, redirect to `/login`

### 1.4 TypeScript Types
- [ ] Define `TaskStatus` enum: `inbox | next_actions | waiting_for | calendar | someday_maybe | notes | trash | done`
- [ ] Define `Task` interface matching DB schema
- [ ] Define `Project` interface matching DB schema
- [ ] Define `RoughPlanItem` type: `{ id: string; text: string; order: number }`

---

## Phase 2 — Authentication (Week 2)

### 2.1 Auth Pages
- [ ] Build `/login` page — email/password form + Google OAuth button
- [ ] Build `/register` page — email/password registration form
- [ ] Build `/reset-password` page — email input for password reset link
- [ ] Apply Liquid Glass styling to all auth pages (frosted card on gradient background)

### 2.2 Auth Logic
- [ ] Implement email/password login via `supabase.auth.signInWithPassword()`
- [ ] Implement Google OAuth via `supabase.auth.signInWithOAuth({ provider: 'google' })`
- [ ] Implement registration via `supabase.auth.signUp()`
- [ ] Implement logout via `supabase.auth.signOut()`
- [ ] Enable Google provider in Supabase Auth dashboard
- [ ] Configure OAuth redirect URL in Supabase + Google Cloud Console
- [ ] Handle auth callback at `/auth/callback` route (exchange code for session)
- [ ] Verify session persists across browser refresh
- [ ] Test redirect: unauthenticated → `/login`; authenticated `/login` → `/inbox`

---

## Phase 3 — App Shell & Design System (Week 2–3)

### 3.1 Liquid Glass Design System
- [ ] Define CSS custom properties in `globals.css`:
  - Glass panel: `backdrop-blur`, `bg-white/10`, `border border-white/20`, `shadow-glass`
  - Color tokens: neutral backgrounds, accent color, text hierarchy
  - Animation tokens: `transition-all duration-150`, `ease-out`
- [ ] Create reusable `<GlassPanel>` component
- [ ] Create `<Button>` variants: primary, secondary, ghost, danger
- [ ] Create `<Input>` component with glass styling
- [ ] Create `<Badge>` component (for inbox count)
- [ ] Create `<Modal>` / `<Overlay>` component with glass backdrop
- [ ] Create `<Spinner>` and skeleton loader components
- [ ] Create `<EmptyState>` component with contextual copy

### 3.2 Navigation & App Shell
- [ ] Build `<Sidebar>` with nav links + active state:
  - Inbox (with count badge)
  - Next Actions
  - Waiting For
  - Someday/Maybe
  - Calendar
  - Notes
  - Trash
  - Projects
- [ ] Build `<QuickCaptureBar>` — persistent input at top of every screen
- [ ] Build `<AppLayout>` — sidebar + main content area
- [ ] Wire up `(app)/layout.tsx` with `<AppLayout>` and auth guard
- [ ] Implement keyboard shortcut: `Enter` submits capture, `Escape` clears input

---

## Phase 4 — Inbox & Quick Capture (Week 3)

### 4.1 Quick Capture
- [ ] Implement `captureTask()` server action — insert task with `status: 'inbox'`
- [ ] Optimistic UI: task appears in inbox instantly on Enter key
- [ ] Input clears immediately after submit; focus returns to input
- [ ] Inbox badge count updates in real-time (Supabase Realtime subscription)
- [ ] Handle 500-char limit with character counter

### 4.2 Inbox List View
- [ ] Build `/inbox` page — list of unprocessed items in reverse-chronological order
- [ ] Build `<InboxItem>` component — title, timestamp, "Process" button, delete button
- [ ] Implement delete (soft delete → `status: 'trash'`) with undo toast
- [ ] Empty state: "Your mind is clear." with motivating copy
- [ ] Skeleton loaders while data loads

---

## Phase 5 — Inbox Processing Flow (Week 4)

### 5.1 Processing Modal
- [ ] Build `<ProcessingOverlay>` — full-screen modal with glass panel
- [ ] Show task title and step progress indicator (e.g., "Step 2 of 5")
- [ ] Implement 5 discrete step components:
  - `<Step1Actionable>` — "Is this actionable?" → Yes / No
  - `<Step2ForMe>` — "Is this for me?" → Yes / No (No → delegated_to input)
  - `<Step3Now>` — "Is this time-sensitive?" → Yes / No with date / No without date
  - `<Step4SingleStep>` — "Is this a single-step task?" → Yes / No
  - `<Step5FiveMinutes>` — "Can it be done in 5 minutes?" → Yes / No
- [ ] Each step transitions with smooth slide animation (`translate-x` transition)
- [ ] No backward navigation — "Cancel" restarts flow from Inbox
- [ ] Implement routing logic:
  - No to step 1 → show [Trash / Notes] choice, move task
  - No to step 2 → capture `delegated_to`, move to `waiting_for`
  - No + date to step 3 → open date picker, move to `calendar`
  - No + no date to step 3 → move to `someday_maybe`
  - No to step 4 → open Project creation form
  - Yes to step 5 → mark task `done` immediately
  - No to step 5 → move to `next_actions`

### 5.2 Server Actions for Processing
- [ ] `processToTrash(taskId)` — status = 'trash'
- [ ] `processToNotes(taskId)` — status = 'notes'
- [ ] `processToWaitingFor(taskId, delegatedTo)` — status = 'waiting_for', set field
- [ ] `processToCalendar(taskId, scheduledAt)` — status = 'calendar', set timestamp
- [ ] `processToSomeDayMaybe(taskId)` — status = 'someday_maybe'
- [ ] `processToNextActions(taskId)` — status = 'next_actions'
- [ ] `processAsDone(taskId)` — status = 'done'

---

## Phase 6 — Task Lists (Week 4–5)

### 6.1 Next Actions List
- [ ] Build `/next-actions` page with `<TaskList>` component
- [ ] `<TaskCard>` component: title, project label, due_date badge, context tags, complete button
- [ ] Mark as complete: `status = 'done'` with completion animation
- [ ] Context filter UI (chips: @Phone, @Computer, @Errands, etc.)
- [ ] Overdue highlighting (red accent if `due_date < now`)
- [ ] Completed items archived, not shown in list

### 6.2 Waiting For List
- [ ] Build `/waiting-for` page
- [ ] `<WaitingForCard>` — title, `delegated_to`, `due_date`, `is_delegation_communicated` toggle
- [ ] Toggle `is_delegation_communicated` with visual feedback (grey → green)
- [ ] Flag uncommunicated items visually

### 6.3 Someday/Maybe List
- [ ] Build `/someday` page — list with move-to-inbox and delete actions

### 6.4 Calendar List
- [ ] Build `/calendar` page — list of time-specific tasks with `scheduled_at` displayed
- [ ] Show Google Calendar sync status per item

### 6.5 Notes List
- [ ] Build `/notes` page — reference items list

### 6.6 Trash
- [ ] Build `/trash` page — soft-deleted items
- [ ] "Empty Trash" button (hard delete all `status = 'trash'` items for user)
- [ ] Restore item from trash (move back to `inbox`)

### 6.7 Shared Task Actions
- [ ] Edit task title inline
- [ ] Set/clear `due_date` via date picker
- [ ] Add/remove context tags
- [ ] Add `due_date` overdue highlighting across all lists

---

## Phase 7 — Project Management (Week 5–6)

### 7.1 Project Creation (from Processing Flow)
- [ ] Build `<ProjectCreationForm>` — inline within `<ProcessingOverlay>` on Step 4 "No"
- [ ] Fields: Title (required), Completion Criteria (required, textarea), Rough Plan (required, multi-line list), First Step (required, text input)
- [ ] On submit: create project + create first-step task with `status: 'next_actions'`
- [ ] Link task to project via `project_id`; set `first_step_task_id` on project

### 7.2 Projects List View
- [ ] Build `/projects` page — list of active projects
- [ ] `<ProjectCard>`: title, active step title, remaining plan items count, completion criteria excerpt

### 7.3 Project Detail View
- [ ] Build `/projects/[id]` page
- [ ] Header: title, completion_criteria, status
- [ ] "Active First Step" zone — highlighted task card
- [ ] "Rough Plan" list — ordered list of draft step text items
- [ ] Completing the first step triggers a nudge: "What's next for [project]?"
- [ ] After first step completion, if project has rough plan items, show promotion UI

### 7.4 Completing a Project
- [ ] When all rough plan items are promoted and completed, prompt user to mark project as complete
- [ ] `completeProject(projectId)` — status = 'completed'
- [ ] Completed projects moved to archive view

---

## Phase 8 — Drag & Drop (Week 6)

### 8.1 dnd-kit Setup
- [ ] Install and configure `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- [ ] Create `<DndProvider>` wrapper using `DndContext`

### 8.2 Next Step Promotion via DnD
- [ ] Wrap `<ProjectDetailView>` rough plan list in `<SortableContext>`
- [ ] Add drag handle icon to each rough plan item (visible on hover)
- [ ] Define `<ActiveTaskDropZone>` — highlighted area for dropping
- [ ] On drop: call `promoteRoughPlanItem(projectId, itemId)` server action
  - Remove item from `rough_plan` JSON array
  - Create new task with `status: 'next_actions'`, `project_id`, title from plan item
  - Update `first_step_task_id` on project
- [ ] Ghost/preview element follows cursor during drag
- [ ] Drop zone highlights with glass-blue glow on drag-over
- [ ] 60fps animation (use CSS transforms, not layout properties)
- [ ] Keyboard fallback: select item + confirm button for non-mouse users

### 8.3 Rough Plan Reordering
- [ ] Allow drag-to-reorder within the rough plan list itself
- [ ] Persist new order to `rough_plan` jsonb array on drop

---

## Phase 9 — Google Calendar Integration (Week 7)

### 9.1 OAuth Setup
- [ ] Set up Google Cloud Console project, enable Calendar API
- [ ] Configure OAuth 2.0 credentials (Web App), add redirect URIs
- [ ] Store `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` in `.env.local`
- [ ] Store refresh token per user in `user_integrations` table

### 9.2 Connect Google Calendar Flow
- [ ] Build `/settings` page with "Connect Google Calendar" button
- [ ] Implement OAuth initiation at `GET /api/google/auth`
- [ ] Implement callback at `GET /api/google/callback` — exchange code, store refresh token
- [ ] Show connected status; "Disconnect" removes token from DB

### 9.3 Calendar Sync Actions
- [ ] `createCalendarEvent(taskId, scheduledAt)` — POST to Google Calendar API
  - Store returned `event_id` in `google_calendar_event_id` on task
- [ ] `updateCalendarEvent(taskId, scheduledAt)` — PATCH event on date change
- [ ] `deleteCalendarEvent(taskId)` — DELETE event when task removed from calendar list
- [ ] Auto-trigger sync in processing flow when task → `calendar` status
- [ ] In-app calendar list shows sync indicator (✓ synced / ⚠ pending)

---

## Phase 10 — Polish & Production Readiness (Week 8)

### 10.1 Animations & Micro-interactions
- [ ] Task capture drop-in animation (slide down + fade)
- [ ] Processing step transitions (slide left/right)
- [ ] Task completion animation (fade out + subtle checkmark)
- [ ] Drag ghost element smooth follow
- [ ] Reduced motion: respect `prefers-reduced-motion` media query

### 10.2 Empty States & Loading
- [ ] Skeleton loaders for all lists (shimmer effect)
- [ ] Empty state copy for each list:
  - Inbox: "Your mind is clear. Nothing to process."
  - Next Actions: "You're all caught up. Enjoy the calm."
  - Waiting For: "Nothing delegated right now."
  - Someday/Maybe: "No deferred ideas yet."
- [ ] Error states with friendly messages + retry button

### 10.3 Accessibility
- [ ] Semantic HTML: `<nav>`, `<main>`, `<section>`, `<article>` used correctly
- [ ] ARIA labels on all icon-only buttons
- [ ] Live region for inbox badge count changes (`aria-live="polite"`)
- [ ] Full keyboard navigation: Tab, Enter, Escape, Arrow keys
- [ ] Visible focus rings on all interactive elements
- [ ] Color contrast ≥ 4.5:1 for body text (verify with browser DevTools)

### 10.4 Performance
- [ ] Run `next build` — verify 0 errors
- [ ] Run Lighthouse — target ≥ 90 performance score
- [ ] Optimize `backdrop-filter` usage (max 2–3 layers stacked)
- [ ] Use `React.Suspense` boundaries for all data-fetching server components
- [ ] Add `loading.tsx` files in all `(app)` route segments

### 10.5 Security Audit ✅
- [x] Verify all Server Actions validate `auth.uid()` before DB operations — shared `authedClient()` in `lib/actions/authed-action.ts`
- [x] Verify all API routes check session before responding — both Google OAuth routes auth-gated
- [x] Test RLS: confirm User A cannot read/write User B's tasks via direct Supabase calls — all mutations include `.eq('user_id', user.id)` belt-and-suspenders
- [x] Confirm Google OAuth scopes limited to `calendar.events` only — `SCOPES = ['https://www.googleapis.com/auth/calendar.events']`
- [x] Ensure `.env.local` values never exposed to client bundle — `GOOGLE_CLIENT_ID/SECRET` have no `NEXT_PUBLIC_` prefix
- [x] `reorderRoughPlan` hardened — server re-orders from DB data; client sends only IDs
- [x] HTTP security headers added to `next.config.ts` — `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`

### 10.6 Deployment
- [ ] Push repo to GitHub
- [ ] Create Vercel project, link to GitHub repo
- [ ] Add all env vars to Vercel project settings
- [ ] Configure Supabase production project (separate from dev)
- [ ] Set Supabase redirect URL to production Vercel domain
- [ ] Run `npm run build` on Vercel — confirm success
- [ ] Smoke test all core flows on production URL

---

## Vibe Coding Session Order

The recommended order for iterative vibe coding sessions:

| Session | Goal |
|---------|------|
| 1 | Install deps + folder structure + Supabase client setup |
| 2 | DB schema SQL + RLS policies in Supabase |
| 3 | Auth pages (login/register) + middleware + Google OAuth |
| 4 | Design system: GlassPanel, Button, Input, Modal tokens |
| 5 | App shell: Sidebar nav + AppLayout + QuickCaptureBar |
| 6 | Inbox list view + capture server action + optimistic UI |
| 7 | Processing overlay + all 5 steps + routing server actions |
| 8 | Next Actions list + task card + mark complete + context filter |
| 9 | Waiting For, Someday/Maybe, Notes, Trash list views |
| 10 | Project creation form (inside processing flow) |
| 11 | Project list view + project detail view |
| 12 | dnd-kit: rough plan reorder + next step promotion |
| 13 | Google Calendar OAuth + event CRUD |
| 14 | Calendar list view + sync status indicators |
| 15 | Animations, empty states, skeleton loaders |
| 16 | Accessibility audit + keyboard nav |
| 17 | Lighthouse + performance pass |
| 18 | Security audit (RLS, server action auth checks) |
| 19 | Vercel deploy + production smoke test |
