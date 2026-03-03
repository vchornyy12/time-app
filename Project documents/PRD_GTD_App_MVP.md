# Product Requirements Document (PRD)

## Document Information
- **Product Name**: GTD App
- **Version**: 1.0 (MVP)
- **Date**: 2026-02-25
- **Author**: [TBD]
- **Status**: Draft
- **Stakeholders**: [TBD]

---

## Executive Summary

GTD App is a minimalist, web-based task management application built around David Allen's Getting Things Done (GTD) methodology. It targets busy professionals — executives, project managers, and knowledge workers — who are overwhelmed by the number of open loops in their personal and professional lives and need a trusted system to regain control.

The core value proposition is a "single window" to offload the brain: a fast capture mechanism, a strict algorithmic inbox processing flow that guides users through proven GTD decision steps, and a drag-and-drop project management interface that makes advancing multi-step work feel effortless. The visual experience is inspired by Apple's Liquid Glass design language — glassmorphism, smooth animations, and zero visual noise — to promote deep focus rather than add cognitive load.

The MVP targets a 6-month development and launch cycle. Success is measured by Daily Active Users (DAU), which signals that users are building the habit of returning to the app as their trusted source of truth every day.

---

## 1. Problem Statement

### 1.1 Background
Knowledge workers today manage a large and growing number of tasks, ideas, commitments, and responsibilities across both personal and professional domains. Without a structured system, these unresolved "open loops" accumulate in the mind, creating mental overhead that degrades focus, decision-making, and overall productivity. The GTD methodology by David Allen offers a proven framework for externalizing this mental load, but its adoption is often hindered by tools that are either too simple (plain to-do lists) or too complex and cluttered to reinforce the methodology's discipline.

### 1.2 Problem Description
Existing task managers fail busy professionals in one of two ways: they lack the structured GTD workflow that makes the system trustworthy, or they are so feature-rich that they become a source of friction and distraction themselves. Users need a purpose-built tool that enforces good GTD habits — strict inbox processing, clear separation of task types, and a reliable mechanism for advancing projects — inside an interface that feels calming and intentional, not busy.

### 1.3 Who Has This Problem?
- **Primary Users**: Busy professionals with high task volume — executives, project managers, knowledge workers aged approximately 28–50, managing 50+ tasks and responsibilities across multiple life areas
- **Secondary Users**: Students and individuals with high personal complexity who have been exposed to GTD concepts and want structure
- **User Pain Points**:
  - Mental overhead from too many unresolved "open loops" causing anxiety and reduced focus
  - Existing tools don't enforce the GTD workflow, leaving users to improvise and skip critical steps
  - Project "next step" management is unclear — users lose track of what to do after completing a task
  - Calendar and ad-hoc tasks live in different systems, creating a fragmented view of commitments

### 1.4 Impact of Not Solving
Without a structured GTD-compliant system, users continue to accumulate open loops mentally, leading to decision fatigue, missed commitments, and reduced productivity. The absence of a purpose-built tool means users either abandon GTD entirely or cobble together imperfect solutions across multiple apps — none of which reinforce the habits that make GTD effective.

---

## 2. Goals and Objectives

### 2.1 Business Goals
- Launch a functional, polished MVP within 6 months
- Establish the app as a credible, habit-forming daily productivity tool for GTD practitioners
- Build a user base that returns daily, validating the core GTD loop (capture → process → act)

### 2.2 User Goals
- Capture any thought or task instantly without friction, anytime during the day
- Process the Inbox to zero using a guided, step-by-step decision flow — no ambiguity, no skipped steps
- Manage multi-step projects with a clear visual plan and always know the single next action to take
- See scheduled and time-specific tasks reflected in Google Calendar without manual duplication

### 2.3 Success Metrics
| Metric | Current State | Target (3 months post-launch) | Measurement Method |
|--------|---------------|-------------------------------|-------------------|
| Daily Active Users (DAU) | 0 (pre-launch) | [TBD based on growth targets] | Analytics (e.g., Posthog / Vercel Analytics) |
| Inbox Processing Rate | N/A | ≥ 70% of inbox items processed within 24h | Backend event tracking |
| Task Capture per Session | N/A | ≥ 3 items captured per DAU session | Backend event tracking |
| User Retention (Day 7) | N/A | ≥ 40% | Cohort analysis |
| Project Completion Rate | N/A | ≥ 50% of created projects reach "done" | Backend task state tracking |

### 2.4 Non-Goals (Out of Scope for MVP 1.0)
- **No native mobile applications** — the MVP is web-only (responsive design for desktop/tablet is acceptable)
- **No team collaboration or multiplayer features** — the app is strictly single-user and personal
- **No third-party task manager integrations** — no sync with Todoist, Jira, Trello, Asana, Notion, or similar tools
- **No AI-powered suggestions or automatic task classification** — all decisions are made explicitly by the user
- **No offline mode** — the app requires an internet connection
- **No advanced reporting or analytics dashboards** for the user

---

## 3. User Stories and Use Cases

### 3.1 User Personas

**Persona 1: The Overwhelmed Executive — "Alex"**
- Demographics: 38 years old, VP of Product at a mid-size tech company
- Goals: Clear the mental backlog every morning, never miss a commitment, always know the next action on every project
- Frustrations: Dozens of Slack messages, emails, and meeting outcomes pile up daily with no single place to capture them; existing tools require too much manual categorization
- Tech proficiency: High — comfortable with web apps, uses Google Workspace daily

**Persona 2: The Freelance Project Manager — "Sam"**
- Demographics: 32 years old, independent consultant managing 4–6 client projects simultaneously
- Goals: Separate client deliverables from personal tasks, process everything quickly, maintain a "Waiting For" list for delegated items
- Frustrations: Juggling multiple projects in a general-purpose to-do app means context switching is slow and the "next action" per project is never obvious
- Tech proficiency: Medium–High — prefers clean, fast tools over feature-heavy platforms

### 3.2 User Stories

**Epic 1: Capture**
- As a busy professional, I want to type a thought into an always-accessible input field and press Enter, so that it lands in my Inbox immediately without interrupting my flow
  - Acceptance Criteria:
    - [ ] A persistent capture input is visible at the top of every screen
    - [ ] Pressing Enter adds the item to the Inbox within 500ms
    - [ ] The input field clears immediately after submission, ready for the next item
    - [ ] The Inbox badge/count updates in real time

**Epic 2: Inbox Processing**
- As a user, I want the app to guide me through GTD decision steps for each inbox item, so that I never have to remember the framework myself
  - Acceptance Criteria:
    - [ ] Each decision step is presented as a clear UI prompt with binary action buttons
    - [ ] The flow follows the defined 5-step sequence (Actionable? → For Me? → Now? → Single Step? → 5 minutes?)
    - [ ] Each answer routes the task to the correct destination list automatically
    - [ ] A user cannot skip steps in the flow
    - [ ] Completing a task ("Do it now") marks it as done and removes it from the active list

**Epic 3: Project Management**
- As a user, I want to create a project with completion criteria, a rough plan, and a designated first step, so that I always know what action to take next on any multi-step effort
  - Acceptance Criteria:
    - [ ] The inbox processing flow offers "Create Project" when user answers "No" to single-step question
    - [ ] Project creation form requires: title, completion criteria, rough plan (free-text list), and first step
    - [ ] The first step is automatically assigned "Next Actions" status and appears in the main task list
    - [ ] Completing the first step triggers a UI prompt to promote the next item from the rough plan

**Epic 4: Next Step Promotion (Drag & Drop)**
- As a user, I want to drag the next item from a project's rough plan into the "Active Task" zone, so that I can formally assign it as the new first step
  - Acceptance Criteria:
    - [ ] The project detail view shows the rough plan list and the current active first step
    - [ ] Items in the rough plan are draggable to the "Active Task" zone via Drag & Drop
    - [ ] Dropping an item converts it from a draft plan entry to a full task with "Next Actions" status
    - [ ] The drag interaction provides visual feedback (ghost element, drop zone highlight)

**Epic 5: Google Calendar Sync**
- As a user, I want tasks with a specific scheduled date/time to appear in my Google Calendar, so that I have a unified view of time-committed work
  - Acceptance Criteria:
    - [ ] Users can connect their Google Calendar via OAuth
    - [ ] When a task is routed to "Calendar" during inbox processing, the user is prompted to set a date/time
    - [ ] The task is created as an event in Google Calendar via the API
    - [ ] Changes to the date/time in the app update the Google Calendar event

**Epic 6: Authentication**
- As a new user, I want to sign up with my email and password or my Google account, so that my data is private and accessible only to me
  - Acceptance Criteria:
    - [ ] Email/password registration and login are functional via Supabase Auth
    - [ ] Google OAuth login is functional via Supabase Auth
    - [ ] Authenticated session persists across browser refreshes
    - [ ] Unauthenticated users are redirected to the login page

### 3.3 Use Cases

**Use Case 1: Capture a Thought**
- Actor: Authenticated user
- Preconditions: User is logged in and on any page of the app
- Main Flow:
  1. User types a thought into the persistent capture input field
  2. User presses Enter
  3. System creates a new inbox item and prepends it to the Inbox list
  4. Input field clears and focus returns to the input
- Alternative Flows: User presses Escape — input clears without creating a task
- Postconditions: New item appears at the top of the Inbox list with a timestamp

**Use Case 2: Process an Inbox Item**
- Actor: Authenticated user
- Preconditions: Inbox contains at least one unprocessed item
- Main Flow:
  1. User opens the Inbox and selects an item to process
  2. App presents Step 1: "Is this actionable?"
  3. User answers each question in the 5-step flow
  4. System routes the item to the correct list based on responses
  5. Item disappears from the Inbox; destination list count updates
- Alternative Flows: User answers "Not Actionable" — item moves to Trash or Notes; User answers "Not for me" — item moves to Waiting For; User answers "No specific date" for time-sensitive items — item moves to Someday/Maybe
- Postconditions: Inbox count decreases by one; item appears in the correct destination list

**Use Case 3: Advance a Project's Next Step**
- Actor: Authenticated user
- Preconditions: A project exists with its first step marked as completed
- Main Flow:
  1. System prompts user to define the next step after marking first step complete
  2. User navigates to the project detail view
  3. User drags the next item from the rough plan into the Active Task zone
  4. System converts the plan item into a full task with "Next Actions" status
  5. The promoted task appears in the Next Actions list
- Postconditions: Project has a new active first step; rough plan list is updated

---

## 4. Functional Requirements

### 4.1 Core Features

**Feature 1: Persistent Quick Capture Input**
- Priority: Must Have
- Description: A Liquid Glass-styled input field always visible at the top of the screen, enabling zero-friction capture of any thought at any moment
- Requirements:
  - Always visible regardless of current navigation context
  - Enter key submits; Escape key cancels
  - Item is added to the Inbox immediately (optimistic UI)
  - Supports up to 500 characters per item

**Feature 2: Inbox**
- Priority: Must Have
- Description: A dedicated list of all unprocessed items, displayed in reverse-chronological order (newest first)
- Requirements:
  - Displays all captured items not yet processed through the GTD flow
  - Shows item count badge in navigation
  - Individual items can be selected to begin processing
  - Items can be manually deleted from the Inbox without processing

**Feature 3: Algorithmic Inbox Processing Flow**
- Priority: Must Have
- Description: A guided, modal-style UI that walks the user through each GTD decision step for a selected inbox item, enforcing strict sequence and routing to the correct list
- Requirements:
  - Step 1 — Actionable? Yes → Step 2 | No → [Trash / Notes]
  - Step 2 — For Me? Yes → Step 3 | No → [Waiting For]
  - Step 3 — Now? Yes → Step 4 | No with date → [Calendar] | No without date → [Someday/Maybe]
  - Step 4 — Single Step? Yes → Step 5 | No → [Create Project flow]
  - Step 5 — Can it be done in 5 minutes? Yes → [DO IT NOW — mark complete] | No → [Next Actions]
  - Each step is a discrete UI state with clear button labels
  - User cannot navigate backwards during a processing session (must cancel and restart)
  - Progress indicator showing current step number

**Feature 4: Task Lists**
- Priority: Must Have
- Description: Dedicated views for each GTD destination list, accessible via primary navigation
- Requirements:
  - **Next Actions**: Active tasks to be done soon; default "work" view
  - **Waiting For**: Delegated tasks — shows who it was delegated to and when
  - **Someday/Maybe**: Ideas and tasks deferred without a date
  - **Calendar**: Time-specific tasks synced to Google Calendar
  - **Notes**: Non-actionable reference material
  - **Trash**: Deleted/non-actionable items (with periodic empty option)
  - Each list supports marking items as complete
  - Completed items are archived, not permanently deleted
  - **Next Actions filtering by context**: Users can filter the Next Actions list by one or more contexts (e.g., @Phone, @Computer, @Errands) to see only tasks relevant to their current situation or available tools; tasks with no context are always visible regardless of active filter
  - **Waiting For tracking columns**: The Waiting For list displays delegated_to (who it was assigned to), due_date (hard deadline), and a visual toggle for is_delegation_communicated — allowing the user to distinguish between "I recorded this in the app" and "I actually communicated the request to the person"
  - **Deadlines (due_date)**: Users can assign a strict due_date to any active task across Next Actions, Waiting For, and Projects; overdue tasks (past due_date) are visually highlighted

**Feature 5: Project Management**
- Priority: Must Have
- Description: A dedicated Projects section for managing multi-step tasks, each with structured metadata and a drag-and-drop rough plan
- Requirements:
  - Project entity fields: Title, Completion Criteria (text), Rough Plan (ordered list of draft steps), First Step (linked task)
  - Projects are created from within the Inbox processing flow
  - Project detail view shows: header metadata, rough plan list, active first step highlighted
  - First step displays as a full task in the Next Actions list with a project label
  - Completing the first step triggers a contextual nudge to promote the next step
  - Projects list view shows: title, active step, completion criteria, count of remaining plan items

**Feature 6: Drag & Drop Next Step Promotion**
- Priority: Must Have
- Description: Within a project's detail view, the user can drag items from the rough plan list into the "Active Task" zone to promote them as the new first step
- Requirements:
  - Drag handle visible on each rough plan item on hover
  - Drop zone clearly highlighted during drag
  - Ghost/preview element follows the cursor during drag
  - Dropping an item converts it from a plain text plan entry to a full task
  - The newly promoted task receives "Next Actions" status automatically
  - Plan list reorders to reflect the promotion

**Feature 7: Google Calendar Integration**
- Priority: Must Have (in-scope for MVP)
- Description: Time-specific tasks routed to "Calendar" during processing are synced as events in the user's Google Calendar
- Requirements:
  - Google OAuth flow to connect calendar (one-time setup per user)
  - Date/time picker presented when a task is routed to Calendar
  - Event created in Google Calendar via Google Calendar API
  - Task updates (date/time changes) propagate to the Google Calendar event
  - Disconnecting Google Calendar removes future sync but retains historical tasks
  - Calendar list in-app shows synced items with their scheduled date/time

**Feature 8: Authentication**
- Priority: Must Have
- Description: Secure user authentication via Supabase Auth supporting email/password and Google OAuth
- Requirements:
  - Email/password registration with email confirmation
  - Google OAuth sign-in (one-click)
  - Session management with auto-refresh (JWT via Supabase)
  - Password reset via email
  - All data is scoped to the authenticated user (row-level security in Supabase)

### 4.2 User Interface Requirements
- Visual language: Apple Liquid Glass — glassmorphism panels (frosted blur, translucent backgrounds), smooth micro-animations, minimal color palette, zero visual noise
- Typography: System font stack or a clean sans-serif (e.g., Inter) for maximum readability
- Interaction model: Keyboard-first where possible; Enter to capture, Escape to cancel, Tab to navigate
- Loading states: Skeleton loaders or subtle shimmer effects — never blank white screens
- Empty states: Friendly, motivating copy for empty Inbox ("Your mind is clear.") and empty lists
- Processing flow: Full-screen or prominent modal overlay with clear progress indication
- Drag & Drop: Native-feeling drag with smooth animations; touch events supported for tablet

### 4.3 Business Logic Requirements
- A task can only exist in one destination list at a time (no duplicates across lists)
- An item remains in the Inbox until explicitly processed or manually deleted
- A Project must have at least one step designated as the active First Step at all times (unless the project is marked complete)
- The "Do it now" path (5-minute rule) marks the task complete immediately — it does not appear in any active list
- Completing a project's first step does NOT automatically promote the next step — the user must explicitly act to promote it (drag or confirm)
- Waiting For items must capture: (1) the person/entity it was delegated to, (2) the original task description, (3) the delegation date
- **Single-Player Delegation**: Because the MVP is strictly single-user and does not integrate with a contacts database, delegating a task to the Waiting For list requires the user to manually type a name or identifier into the free-text delegated_to field — no contact lookup or in-app messaging
- **Two-Step Delegation State**: A delegated task starts with is_delegation_communicated = false ("pending communication"). The user must explicitly toggle this to true to confirm the real-world handover has occurred (e.g., email sent, Slack message written, call made); untoggled items can be visually flagged as "not yet communicated"
- **Deadlines vs. Scheduling**: due_date is a hard deadline representing when a task must be completed (external commitment); scheduled_at is the specific date/time blocked on Google Calendar to actually do the work — a task can have both, one, or neither

### 4.4 Data Requirements
- **Captured per Task**: ID, title/description, created_at, updated_at, status (inbox | next_actions | waiting_for | calendar | someday_maybe | notes | trash | done), user_id, project_id (nullable), scheduled_at (Timestamp, nullable — for Google Calendar blocking), due_date (Timestamp, nullable — for strict deadlines), delegated_to (String, nullable — simple free-text field for manual entry), is_delegation_communicated (Boolean, default: false — tracks if the user actually sent the message/made the call), google_calendar_event_id (nullable), contexts (Array of Strings, nullable — e.g., ["@Office", "@Calls"])
- **Captured per Project**: ID, title, completion_criteria, rough_plan (ordered JSON array), first_step_task_id, created_at, updated_at, status (active | completed), user_id
- Data validation: Task title required (1–500 chars); project title required (1–200 chars); completion criteria required for project creation; first step required for project creation
- Data retention: User data retained for the life of the account; deleted items moved to Trash (soft delete); Trash can be emptied by user

---

## 5. Technical Requirements

### 5.1 System Architecture
A Next.js web application with server-side rendering for initial page loads and client-side interactivity for real-time task updates. Supabase provides the managed PostgreSQL database, authentication, and real-time subscriptions. Google Calendar API handles calendar event synchronization. Deployment targets Vercel (optimal for Next.js).

```
[Browser] ←→ [Next.js App (Vercel)]
                    ↕ Supabase JS SDK
               [Supabase]
               ├── Auth (Email/Google OAuth)
               ├── PostgreSQL (tasks, projects, users)
               └── Realtime (live task updates)
                    ↕ Google Calendar API
               [Google Calendar]
```

### 5.2 Technology Stack
- **Frontend**: Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS 4
- **Backend**: Next.js API Routes / Server Actions
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Authentication**: Supabase Auth (Email/Password + Google OAuth)
- **Drag & Drop**: [TBD — dnd-kit recommended for accessibility and React 19 compatibility]
- **Calendar Integration**: Google Calendar API v3
- **Infrastructure**: Vercel (hosting), Supabase (managed DB + Auth)
- **Analytics**: [TBD — Vercel Analytics or PostHog]

### 5.3 Performance Requirements
- Page initial load (LCP): < 2.5 seconds on a standard broadband connection
- Task capture to Inbox (end-to-end): < 500ms perceived (optimistic UI)
- Inbox processing step transitions: < 150ms (client-side state only)
- API response time (database reads): < 300ms at p95
- Drag & Drop frame rate: ≥ 60 fps during drag interactions
- Uptime: ≥ 99.5% (leveraging Vercel + Supabase SLA)

### 5.4 Security Requirements
- Authentication: Supabase Auth with JWT session tokens; tokens auto-refreshed
- Authorization: Supabase Row Level Security (RLS) — all DB queries are scoped to `auth.uid()` by policy; no user can read or write another user's data
- Data encryption: In transit via HTTPS/TLS (Vercel + Supabase enforce this); at rest via Supabase's AES-256 encryption
- Google OAuth: Scopes limited to `calendar.events` (write) and `calendar.readonly` (read); no access to Gmail, Contacts, or other Google services
- CSRF protection: Handled by Next.js server actions and Supabase client
- Compliance: GDPR-aligned data handling (user data deletable on account deletion)

### 5.5 Integration Requirements
| Integration | Purpose | Type | Priority |
|-------------|---------|------|----------|
| Supabase Auth | User authentication (Email + Google OAuth) | Supabase JS SDK | Must Have |
| Supabase Database | All task and project data persistence | Supabase JS SDK + RLS | Must Have |
| Google Calendar API | Sync time-specific tasks as calendar events | REST API (OAuth 2.0) | Must Have |

### 5.6 Technical Constraints
- Application must run in modern browsers (Chrome 120+, Firefox 120+, Safari 17+, Edge 120+)
- No native mobile app — web only for MVP
- Must work at minimum 1280px viewport width (desktop-first); tablet support (768px+) is desirable
- Supabase free tier limits apply during early development; production will require a paid plan
- Google Calendar API has quota limits (10,000 requests/day on free tier) — batching and caching required at scale

---

## 6. Design and User Experience

### 6.1 Design Principles
- **Zero Visual Noise**: Every element on screen must earn its place. No decorative clutter, no feature sprawl visible at once
- **Calm Focus**: The interface should slow the user down slightly and encourage deliberate action, not stimulate urgency
- **Liquid Glass**: Glassmorphism aesthetic — frosted panels, layered translucency, soft shadows, subtle gradients; inspired by Apple's macOS/iOS design language
- **Keyboard-First**: Power users should be able to navigate and operate entirely via keyboard; mouse/touch are supported but secondary
- **Progressive Disclosure**: Complex features (project creation, calendar settings) are revealed contextually — never all at once

### 6.2 User Flows

**Flow 1: Quick Capture**
1. User sees persistent capture input at top of any screen
2. Types thought, presses Enter
3. Item appears at top of Inbox list with a subtle drop-in animation
4. Input clears and is ready for next item

**Flow 2: Inbox Processing**
1. User opens Inbox, taps/clicks an item
2. Full-screen processing overlay appears with Step 1: "Is this actionable?"
3. User clicks Yes or No
4. System transitions to the next step with a smooth slide animation
5. On final decision, item routes to destination with a satisfying completion animation
6. Overlay closes, user is back on Inbox with one fewer item

**Flow 3: Project Creation from Inbox**
1. During processing, user answers "No" to "Single Step?"
2. Project creation form appears in the overlay: Title, Completion Criteria, Rough Plan, First Step
3. User fills in fields and confirms
4. Project is created; First Step task appears in Next Actions
5. Inbox item is archived as the project source

**Flow 4: Promoting the Next Project Step**
1. User marks the current First Step as complete
2. A contextual card/nudge appears: "What's the next step for [Project Name]?"
3. User opens project detail view
4. User drags the desired item from the Rough Plan into the Active Task zone
5. Item is promoted to a full task; appears in Next Actions

**Flow 5: Google Calendar Sync Setup**
1. User routes an item to "Calendar" during inbox processing
2. Date/time picker appears in the processing overlay
3. If Google Calendar is not connected, a one-time "Connect Google Calendar" prompt appears
4. User authorizes via Google OAuth
5. Task is created as a Google Calendar event; confirmation shown in-app

### 6.3 Accessibility Requirements
- WCAG compliance level: AA
- Keyboard navigation: Full keyboard operability for all core flows (Tab, Enter, Escape, Arrow keys for drag & drop keyboard mode)
- Screen reader support: Semantic HTML, ARIA labels on interactive elements, live region announcements for inbox count changes
- Color contrast: Minimum 4.5:1 ratio for body text; 3:1 for large text and UI components
- Focus indicators: Clearly visible focus rings on all interactive elements (not removed via `outline: none` without replacement)

### 6.4 Responsive Design
- Primary target: Desktop (1280px and above)
- Secondary target: Tablet (768px–1279px) — layout adapts, DnD remains functional
- Out of scope for MVP: Mobile (< 768px) — no native app, limited mobile web optimization

---

## 7. Dependencies and Assumptions

### 7.1 Dependencies
- **Supabase**: Authentication, database, and real-time functionality — all core features depend on Supabase availability; outage would make the app non-functional
- **Google Calendar API**: Calendar sync feature depends on Google's API availability and quota; quota limits could impact heavy users at scale
- **Vercel**: Hosting and deployment pipeline; CDN and serverless functions rely on Vercel uptime

### 7.2 Assumptions
- Users have a modern web browser and stable internet connection
- The GTD methodology is understood conceptually by users — the app reinforces it but does not teach it from scratch
- Each user manages their data independently (no shared state or collaboration)
- Google Calendar is the primary calendar tool used by the target persona (vs. Apple Calendar or Outlook)
- The Supabase free tier is sufficient for development; production will be upgraded before launch

### 7.3 Risks and Mitigation
| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| Google Calendar API quota exhaustion at scale | Medium | Medium | Implement request batching, caching of event IDs; upgrade API quota tier proactively |
| Drag & Drop performance on lower-end devices | Medium | Low | Use dnd-kit (lightweight, optimized); test on mid-range hardware; provide keyboard alternative |
| Glassmorphism visual complexity slowing render | Low | Medium | Use CSS `backdrop-filter` sparingly; test Lighthouse performance score; provide a reduced-motion fallback |
| Supabase RLS misconfiguration exposing user data | Low | High | Code review all RLS policies; add automated tests that verify cross-user data isolation |
| User abandonment if inbox processing feels rigid | Medium | High | Add a "Skip processing / just categorize" escape hatch; conduct usability testing with 5 users pre-launch |
| 6-month timeline overrun due to scope creep | Medium | High | Strictly enforce MVP non-goals list; defer any new feature requests to a backlog |

---

## 8. Timeline and Milestones

### 8.1 Project Phases

**Phase 1: Foundation (Months 1–2)**
- Duration: 8 weeks
- Key Deliverables:
  - Authentication (Email/Password + Google OAuth via Supabase)
  - Database schema finalized (tasks, projects, users tables with RLS)
  - Inbox capture and basic Inbox list view
  - Navigation and app shell with Liquid Glass design system
- Success Criteria: A user can register, log in, and capture items to the Inbox

**Phase 2: Core GTD Flow (Months 2–4)**
- Duration: 8 weeks
- Key Deliverables:
  - Algorithmic Inbox Processing (5-step guided flow, all routing logic)
  - All 6 destination task lists with full CRUD
  - Task state machine (inbox → processing → destination)
  - "Next Actions" list as the primary work view
- Success Criteria: A user can process their entire Inbox to zero and see all items correctly categorized

**Phase 3: Projects & Drag & Drop (Months 3–5)**
- Duration: 8 weeks (overlaps with Phase 2 completion)
- Key Deliverables:
  - Project creation from inbox processing flow
  - Project detail view (completion criteria, rough plan, active step)
  - Drag & Drop step promotion within projects
  - Project list view and navigation
- Success Criteria: A user can create a project from the Inbox, manage its plan, and promote next steps via drag & drop

**Phase 4: Integration, Polish & Launch (Months 5–6)**
- Duration: 4 weeks
- Key Deliverables:
  - Google Calendar API integration (sync, OAuth, event management)
  - End-to-end QA across all flows
  - Performance optimization (Lighthouse score ≥ 90)
  - Accessibility audit (WCAG AA)
  - Deployment pipeline to Vercel production
- Success Criteria: All MVP features functional, no P0/P1 bugs, performance targets met, app deployed to production URL

### 8.2 Timeline
| Milestone | Target Date | Owner | Status |
|-----------|-------------|-------|--------|
| Database schema & auth working | Month 1, Week 4 | [TBD] | Not Started |
| Inbox capture & list complete | Month 2, Week 2 | [TBD] | Not Started |
| Algorithmic processing flow complete | Month 3, Week 2 | [TBD] | Not Started |
| All task lists functional | Month 3, Week 4 | [TBD] | Not Started |
| Project management & DnD complete | Month 5, Week 2 | [TBD] | Not Started |
| Google Calendar integration complete | Month 5, Week 4 | [TBD] | Not Started |
| QA complete & bugs resolved | Month 6, Week 2 | [TBD] | Not Started |
| Production launch | Month 6, Week 4 | [TBD] | Not Started |

---

## 9. Testing and Quality Assurance

### 9.1 Testing Strategy
- **Unit testing**: Core business logic (task routing rules, project state machine, GTD decision flow) — target 80% coverage
- **Integration testing**: Supabase interactions (CRUD operations, RLS policy enforcement, real-time subscriptions), Google Calendar API calls
- **End-to-end testing**: Critical user journeys (capture → process → complete, project creation and next step promotion) using Playwright
- **Performance testing**: Lighthouse CI on each PR; target scores ≥ 90 for Performance, ≥ 90 for Accessibility
- **Security testing**: Manual review of all RLS policies; cross-user data isolation tests; OWASP Top 10 review before launch
- **Usability testing**: 3–5 users walk through core flows before launch; specific focus on inbox processing clarity

### 9.2 Test Scenarios

**Scenario 1: Inbox to Next Actions (Actionable, Single Step, > 5 min)**
- Given: User has an item in the Inbox
- When: User processes with Yes → Yes → Yes → Yes → No
- Then: Item appears in Next Actions list with correct title and timestamp

**Scenario 2: Project Creation from Inbox**
- Given: User processes an item and answers No to "Single Step?"
- When: User fills in project title, criteria, plan, and first step and confirms
- Then: Project appears in Projects list; first step appears in Next Actions with project label

**Scenario 3: Google Calendar Sync**
- Given: User has connected Google Calendar
- When: User routes a task to Calendar and sets a date/time
- Then: Event appears in Google Calendar within 5 seconds; in-app Calendar list shows the event

**Scenario 4: Cross-User Data Isolation**
- Given: Two users exist with separate tasks
- When: User A's JWT is used to query User B's task IDs
- Then: Supabase RLS returns 0 rows; no data leakage

### 9.3 Acceptance Criteria
- [ ] All 5-step inbox processing paths route to the correct destination list
- [ ] Projects require completion criteria, rough plan, and first step to be created
- [ ] Drag & drop promotes a plan item to a task with Next Actions status
- [ ] Google Calendar events are created and updated in sync with in-app task changes
- [ ] Authentication via Email/Password and Google OAuth both work end-to-end
- [ ] No user can access another user's data (RLS enforced)
- [ ] Lighthouse performance score ≥ 90 on production build
- [ ] WCAG AA color contrast passes for all primary text and UI elements

---

## 10. Launch and Rollout Plan

### 10.1 Launch Strategy
- Launch type: Soft launch / Beta
- Target audience: Invited beta users (early adopters, personal network, GTD practitioners communities)
- Rollout: 100% access from day one — no feature flags or percentage rollout needed for MVP

### 10.2 Go-Live Checklist
- [ ] All acceptance criteria met
- [ ] Security review completed (RLS policies audited)
- [ ] Performance testing passed (Lighthouse ≥ 90)
- [ ] E2E tests passing in CI/CD pipeline
- [ ] Google Calendar OAuth app verified by Google (or "Testing" mode for beta)
- [ ] Supabase production project on paid plan (database backups enabled)
- [ ] Vercel production deployment configured with custom domain
- [ ] Error monitoring configured (e.g., Sentry)
- [ ] Analytics tracking configured (DAU measurement ready)
- [ ] Rollback plan: previous Vercel deployment retained for instant revert

### 10.3 Communication Plan
| Audience | Message | Channel | Timing |
|----------|---------|---------|--------|
| Beta users | "GTD App is live — your trusted system awaits" | Email invite | Launch day |
| GTD practitioner communities | Product Hunt or community post | Reddit /r/gtd, ProductHunt | Launch week |

---

## 11. Post-Launch

### 11.1 Monitoring Plan
- Metrics to track: DAU, task capture events per session, inbox processing rate, task completion rate, error rate, API response times
- Dashboard/tools: Vercel Analytics (web vitals), Supabase Dashboard (DB metrics), error tracking tool (e.g., Sentry)
- Alert thresholds: Error rate > 1% triggers immediate investigation; p95 API latency > 1s triggers performance review

### 11.2 Success Evaluation
- Review date: 30 days post-launch, then monthly
- Success criteria: DAU trending upward week-over-week; Day 7 retention ≥ 40%; inbox processing rate ≥ 70% within 24h

### 11.3 Iteration Plan
- Feedback collection: In-app feedback button (lightweight form); optional user interviews at 30-day mark
- Improvement cycle: 2-week sprint cadence post-launch; backlog groomed monthly based on DAU data and user feedback

---

## 12. Support and Maintenance

### 12.1 Support Requirements
- Support channels: Email (support inbox) for beta period
- Support hours: Best-effort during business hours for beta
- SLA targets: P0 (app down) — resolve within 4 hours; P1 (data loss risk) — resolve within 24 hours

### 12.2 Documentation
- User documentation: Short onboarding guide explaining the GTD flow within the app (in-app or landing page)
- Technical documentation: README with setup instructions, environment variables, and deployment guide
- API documentation: N/A (no public API in MVP)

### 12.3 Maintenance Plan
- Update frequency: As-needed bug fixes; feature releases on sprint cadence post-launch
- Backup strategy: Supabase managed backups (daily on paid plan)
- Disaster recovery: Vercel instant rollback; Supabase point-in-time recovery

---

## 14. Appendix

### 14.1 References
- `project_vision.md` — Original product vision document (this PRD's primary source)
- GTD Methodology: David Allen, *Getting Things Done* (2001, revised 2015)
- Apple Liquid Glass Design Language — WWDC 2025 design session references

### 14.2 Glossary
- **GTD**: Getting Things Done — a personal productivity methodology by David Allen
- **Inbox**: The GTD "capture" list; a staging area for all uncategorized inputs
- **Open Loop**: Any uncommitted thought, task, or idea that occupies mental bandwidth
- **Inbox Processing**: The GTD "clarify" step — working through each inbox item using a defined decision tree
- **Next Actions**: GTD term for tasks that are ready to be acted on immediately
- **Waiting For**: Tasks delegated to others, pending their action
- **Someday/Maybe**: Ideas and tasks deferred with no commitment date
- **Rough Plan**: In this app, the ordered list of future steps within a project (not yet converted to active tasks)
- **First Step**: The single active task associated with a project; represents the immediate next action
- **Drag & Drop (DnD)**: The interaction for promoting a rough plan item to an active task within a project
- **Liquid Glass**: Apple's 2025 glassmorphism-inspired visual design language (frosted, translucent UI surfaces)
- **RLS**: Row Level Security — a Supabase/PostgreSQL feature enforcing per-user data access at the database level

### 14.3 Change Log
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-02-25 | [TBD] | Initial draft |
| 1.1 | 2026-02-25 | [TBD] | Added contexts, due_date, is_delegation_communicated to data model; added context filtering, Waiting For tracking, and deadline requirements to Feature 4; added delegation and deadline business logic rules to §4.3 |

---

## Sign-off

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Product Manager | | | |
| Engineering Lead | | | |
| Design Lead | | | |
| Stakeholder | | | |
