# Feature Specification: GTD Agent Integration (MCP server, connector, skill)

## Document Information
- **Feature Spec ID**: FS-001
- **Originating Request**: none
- **Title**: GTD Agent Integration for time-app (MCP server, Claude connector, triage skill)
- **Author**: Volodymyr Chornyi
- **Date**: 2026-11-18
- **Status**: Draft
- **Priority**: P1-High (proposed)
- **Target Release**: NEEDS CLARIFICATION
- **Related Documents**:
  - Repository: https://github.com/vchornyy12/time-app (public)
  - Interim inbox: "GTD Inbox — Volodymyr" Google Sheet (https://docs.google.com/spreadsheets/d/1fX4p-ELLJFtoHV5bXAbv6d6-qx-1izd00VrCNnfphRU/edit)
  - PRD: `Project documents/PRD_GTD_App_MVP.md` in the repository
  - Issue: none yet

## Document Status Tracking
| Status | Date | Notes |
|--------|------|-------|
| Drafted | 2026-11-18 | Initial draft from the brainstorming thread |

## 1. Feature Overview

### 1.1 Executive Summary
An AI agent (Claude) captures candidate action items from connected sources (Bluedot call transcripts, Gmail, and later Google Chat) into the time-app Inbox through a new MCP server and Claude connector. A triage skill tells Claude how to extract, deduplicate and label items. The human stays the only approver: items reach the Inbox as proposals, and external actions (Jira, Gmail drafts, Chat pings) run only after the user processes the task in the app.

### 1.2 Problem Statement
**Current Situation**:
Commitments made in calls, emails and chats are not captured in one place. A temporary Google Sheet inbox duplicates app state and has no processing flow. Triage is manual and happens in the user's head.

**Impact of Problem**:
- Business impact: missed follow-ups, scope changes and risks; PM time spent re-reading transcripts.
- User impact: the user is the bottleneck for every open loop; the team has one developer, so tracking delegated work by hand is costly.
- Frequency: daily.
- Severity: High.

**Who is Affected**:
- User personas: project manager running multiple client and internal workstreams.
- Scale: single user for MVP.
- Departments: Binariks internal projects (e.g., Binariks site).

### 1.3 Proposed Solution (High-Level)
1. **MCP server** inside time-app that exposes a narrow set of tools: capture into Inbox, and read-only views of Inbox, Waiting For and Next Actions.
2. **Claude connector** registering that MCP server in the user's Claude account (custom connector).
3. **Triage skill** (`gtd-triage`) instructing Claude how to read sources, extract candidates, deduplicate them and capture them.
4. **Approval gate**: the only write an agent can make to the app is creating an Inbox item. Processing (clarify, next action, delegation, deletion) stays with the human in the app. External actions are triggered by a tag the human sets during processing.

### 1.4 Expected Outcomes
**Success looks like**:
- Candidate action items from all connected sources appear in the app Inbox within one scheduled cycle.
- No external write (Jira, email, chat) happens without a human processing action.
- The Google Sheet interim inbox is retired.

**Success Metrics**:
- Items captured per day: baseline set in week 1, then tracked.
- Acceptance rate of agent items (processed to next action or waiting for, not trashed): target at least 60% after two weeks (proposed; NEEDS CLARIFICATION).
- Unapproved external writes: 0, verified by audit log.
- Time to clarify one item: under 2 minutes (proposed).

## 2. Requirements Clarification

### 2.1 Detailed Requirements

**Functional Requirements**:
1. **FR-1 Capture tool** `capture_inbox_item(title, source, source_ref, source_quote, dedupe_key, proposed_type, proposed_owner, proposed_due, confidence, notes)`:
   - Creates a task with status `inbox` for the authenticated user.
   - User need: every candidate lands in one place without manual copying.
   - Must-have.
   - Acceptance criteria: calling it twice with the same `dedupe_key` returns the existing task and creates no duplicate.
2. **FR-2 Read tools** `list_inbox`, `list_waiting_for`, `list_next_actions`, `get_task`:
   - Read-only, scoped to the authenticated user.
   - Must-have.
   - Acceptance criteria: a request authenticated as user A never returns user B's tasks.
3. **FR-3 No other write tools.** Processing, deletion, completion, delegation edits and status changes are not exposed to the agent. The single exception is `set_external_ref(task_id, external_ref)`, which only stores the identifier of an external object (e.g., a Jira key) after the agent has executed an approved action.
   - Must-have.
   - Acceptance criteria: the MCP tool list contains exactly one mutating tool for captures and one that only writes `external_ref`.
4. **FR-4 Source visibility in the app.** Inbox items created by the agent show source, source link, quote and proposed fields in the item detail view.
   - Must-have.
   - Acceptance criteria: the user can open the source link from the item and see the quote without leaving the app.
5. **FR-5 External action tag.** During processing, the user can set `external_action` to one of `none`, `jira`, `gmail_draft`, `chat_ping`. Only a human processing action can set it.
   - Must-have.
   - Acceptance criteria: the MCP server rejects any attempt to set `external_action`.
6. **FR-6 Triage skill.** The `gtd-triage` skill reads configured sources since the stored cursor, extracts candidates, applies deduplication keys, and captures them. It executes external actions only for tasks that have `external_action` set and no `external_ref` yet.
   - Must-have.
   - Acceptance criteria: a run with no approved tasks makes zero calls to Jira, Gmail or Chat write tools.
7. **FR-7 Agent state.** The skill stores a per-source cursor (last processed Bluedot meeting ID, Gmail history ID, Chat space checkpoint) and the time of the last run, so runs are idempotent.
   - Must-have.
   - Acceptance criteria: after a failed run the cursor is not advanced.
8. **FR-8 Audit log.** Every MCP call that writes is recorded with user, tool, task ID, timestamp and result.
   - Should-have.
   - Acceptance criteria: the log can answer "which external actions were executed, and which processing action authorized them".

**Non-Functional Requirements**:
- Performance: capture call p95 under 500 ms; read calls p95 under 300 ms (aligned with PRD targets).
- Scalability: single user for MVP; design must not preclude multi-user.
- Security: user-scoped Supabase JWT authentication; RLS enforced on every query; no service-role key in the MCP path; secrets only in environment configuration.
- Privacy: transcripts and mail may contain HR and personal data. The skill excludes configured topics and people (see 2.6). Quotes are stored only as long as the task exists, and are deleted with the task.
- Accessibility: follow existing app standards.
- Usability: item detail must show the source in one screen, with no extra clicks.

### 2.2 User Flows

**Flow 2.2.1: Agent captures candidates from a scheduled run** (persona: project manager, entry point: scheduled task)
| # | User action | System response | What the user sees |
|---|-------------|-----------------|--------------------|
| 1 | None (schedule fires) | Claude starts the run, loads the triage skill | Nothing |
| 2 | None | Skill reads the Bluedot cursor and fetches new meetings | Nothing |
| 3 | None | Skill extracts candidates, computes dedupe keys | Nothing |
| 4 | None | Skill calls `capture_inbox_item` per candidate | Nothing yet |
| 5 | None | Cursor is advanced; run summary stored | New items appear in the app Inbox with a source badge |

- **Trigger**: scheduled task (proposed every 2 hours on working days, NEEDS CLARIFICATION).
- **End state**: new Inbox items exist, cursors are advanced.

```mermaid
flowchart LR
    A[Schedule] --> B[Read cursor] --> C[Fetch sources] --> D[Extract and dedupe] --> E[capture_inbox_item] --> F[Cursor advanced]
```

**Flow 2.2.2: User processes an agent item in the app** (persona: project manager, entry point: Inbox)
| # | User action | System response | What the user sees |
|---|-------------|-----------------|--------------------|
| 1 | Opens an agent item | Shows title, source, quote, proposed fields | Item detail with source link |
| 2 | Chooses processing: Next action, Waiting For, Project, Someday, Reference or Trash | Applies the existing processing action | Task moves to the chosen list |
| 3 | Optionally sets external action (Jira, Gmail draft, Chat ping) | Stores `external_action` | Tag visible on the task |
| 4 | Confirms | Task saved | Task appears in its list |

- **Trigger**: user opens the Inbox.
- **End state**: task is in its list; if an external action was chosen, it is queued for the next run.

**Flow 2.2.3: Agent executes an approved external action** (persona: project manager, entry point: scheduled run)
| # | User action | System response | What the user sees |
|---|-------------|-----------------|--------------------|
| 1 | None | Skill lists tasks with `external_action` set and no `external_ref` | Nothing |
| 2 | None | Skill creates the Jira issue or Gmail draft through the matching connector | Nothing |
| 3 | None | Skill calls `set_external_ref` with the Jira key or draft ID | Task shows external reference |

- **Trigger**: scheduled run finds approved tasks.
- **End state**: external object exists and is linked to the task.

### 2.3 Alternative and Exception Flows
| Flow | Branch at step | Condition | What the user sees | What the user can do |
|------|----------------|-----------|--------------------|----------------------|
| 2.2.1 | 1 | **Error:** MCP token missing or expired | Run fails with authentication error in the run summary | Reconnect the connector |
| 2.2.1 | 4 | **Alternative:** `dedupe_key` already exists | Existing task returned, no duplicate | None needed |
| 2.2.1 | 2 | **Error:** Bluedot unavailable | Run skips Bluedot, cursor not advanced | Retry on next run |
| 2.2.1 | 3 | **Limit:** more than 50 candidates in one run | First 50 captured, rest deferred to next run | None needed |
| 2.2.1 | 3 | **Exclusion:** content matches a configured HR or personal topic | Candidate not captured | Update exclusion list |
| 2.2.2 | 2 | **Empty state:** Inbox empty | "Inbox is empty" message | None needed |
| 2.2.3 | 2 | **Error:** Jira or Gmail connector fails | `external_action` stays set, run summary records the error | Retry on next run or fix connector |
| 2.2.3 | 1 | **Alternative:** user changed `external_action` to none before the run | Task skipped | None needed |

### 2.4 What Changes for the User
| Area | Before | After | Type |
|------|--------|-------|------|
| Inbox | Only manually captured items | Agent-captured items with source badge | Changed |
| Task detail | Title and fields only | Source, quote, proposed fields, external reference | Changed |
| Processing dialog | Existing processing options | Adds external action selector | Changed |
| Interim Google Sheet inbox | Stores candidates | Retired after migration | Removed |
| Claude settings | No time-app connector | time-app connector added | New |
| Public API | None | MCP endpoint at `/api/mcp` | New |

- **UI changes**: source badge and detail panel in Inbox item view; external action selector in processing dialog.
- **Habits and data**: user processes agent items in the app instead of the sheet. Existing tasks get empty source fields; no backfill required.
- **Communication and migration**: none for end users at MVP. Migrate sheet items manually if any are still needed.

### 2.5 Assumptions
- The time-app Supabase project used in production is the same one the MCP server will use (NEEDS CLARIFICATION: is time24.pro this deployment?).
- Claude custom connectors are available on the user's Team plan, with admin approval if required (same as the Google Chat connector).
- Bluedot, Gmail and Atlassian connectors remain connected and are usable from scheduled runs.
- Google Chat source depends on the Chat MCP connector, which is pending admin setup.
- Single-user MVP.

### 2.6 Open Questions
- [ ] Which deployment is time24.pro, and which Supabase project does it use? - Assigned to: Volodymyr - Due: NEEDS CLARIFICATION
- [ ] Authentication for the connector: Supabase OAuth server, or a per-user token? Verify what Claude custom connectors support. - Assigned to: Volodymyr - Due: NEEDS CLARIFICATION
- [ ] Exclusion list for HR and personal topics: which topics, which people? - Assigned to: Volodymyr - Due: NEEDS CLARIFICATION
- [ ] Retention for `source_quote`: keep until task deletion, or shorter? - Assigned to: Volodymyr - Due: NEEDS CLARIFICATION
- [ ] Should `external_action` run from the app itself, or only from the skill? - Assigned to: Volodymyr - Due: NEEDS CLARIFICATION
- [ ] App locale: which languages must the new UI support? - Assigned to: Volodymyr - Due: NEEDS CLARIFICATION

---

## 3. Technical Analysis

### 3.1 Technical Feasibility
**Complexity Assessment**: Moderate

**Technical Challenges**:
1. **Streamable HTTP MCP in a Next.js route handler on Netlify**: function time limits and cold starts. Mitigation: keep tool calls short, one query per call, measure p95 early.
2. **OAuth for a custom connector**: the connector must authenticate the user, and the MCP route must validate that user's Supabase session. Mitigation: validate the Supabase access token with `supabase.auth.getUser`, following the pattern in `app/api/mobile/process-inbox/route.ts`.
3. **Writes outside server actions**: the data layer rule in `CLAUDE.md` is "server actions only". The MCP route is a second entry point, so it needs its own validation layer (Zod, reusing `lib/validation`) and the same RLS scoping.

**Technical Risks**:
| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Connector auth not supported as planned | M | H | Spike in week 1 before building tools |
| Netlify limits break long runs | L | M | Keep tool calls small; cap captures per run |
| Prompt injection from transcripts or mail triggers unwanted writes | M | H | Only capture tool is writable; no delete/process tools; external actions only from human tags |
| Quotes leak personal data | M | H | Exclusion list, retention rule, RLS |

### 3.2 System Impact Analysis
**Affected Components**:
- Frontend: Inbox item detail (source, quote, proposed fields); processing dialog (external action selector).
- Backend: new route `app/api/mcp/route.ts`; new validation schemas for MCP inputs; an agent audit writer.
- Database: new columns on `tasks` (`source`, `source_ref`, `source_quote`, `dedupe_key`, `confidence`, `external_action`, `external_ref`, `agent_proposed`); new table `agent_state` (per-user, per-source cursor); new table `agent_events` (audit).
- Infrastructure: none beyond current Netlify and Supabase.
- Third-party: Claude custom connector; Bluedot, Gmail, Atlassian connectors; Google Chat (pending).

**Integration Points**:
- Internal systems: Supabase (auth, tasks, RLS).
- External APIs: Bluedot (via connector), Gmail (via connector), Jira (via Atlassian connector), Google Chat (via Chat MCP connector, pending).
- Data sources: transcripts, email threads, chat messages.

**Dependencies**:
- **Blockers**: confirmation of the production Supabase project; connector auth spike.
- **Related work**: existing processing actions in `lib/actions/processing.ts`; mobile process-inbox route.
- **Future work**: mobile app triage of agent items; weekly review digest generated from `agent_events`.

### 3.3 Data Requirements
**New Data Entities**:
- `agent_state`: user_id, source, cursor, last_run_at, last_error.
- `agent_events`: id, user_id, tool, task_id, result, created_at. Append-only.

**Modified Data Entities**:
- `tasks`: new nullable columns listed in 3.2. `dedupe_key` unique per user where not null.

**Data Volume Estimates**:
- Records per day: roughly 20 to 50 candidates (estimate).
- Storage: negligible at single-user scale.
- Growth rate: linear with usage.

**Data Migration**:
- Migration needed: Yes (additive, nullable columns). No backfill.

### 3.4 Security and Privacy
**Security Considerations**:
- Authentication: user-scoped bearer token validated per request; anonymous calls rejected with 401.
- Authorization: every query filtered by `user_id` and protected by RLS.
- Data encryption: Supabase defaults; no extra fields.
- Audit logging: `agent_events` for every write.

**Privacy Considerations**:
- PII handling: transcripts and mail contain names and possibly HR details. Exclusion list in the skill; quotes limited to what the user needs to decide.
- Data retention: NEEDS CLARIFICATION (see 2.6).
- GDPR/CCPA: NEEDS CLARIFICATION for any third-party data stored in the app.
- User consent: the user is the only data owner at MVP; consent for colleagues' speech in transcripts to be confirmed with the company.

### 3.5 Performance Considerations
**Expected Load**:
- Concurrent users: 1.
- Requests per second: under 1 on average.
- Data volume: see 3.3.

**Performance Requirements**:
- Response time: capture p95 under 500 ms; reads under 300 ms.
- Throughput: not a constraint at MVP.
- Resource usage: serverless function limits.

**Optimization Needs**:
- Caching strategy: none at MVP.
- Database indexing: index on `(user_id, dedupe_key)` unique; index on `(user_id, status)`.
- Query optimization: list queries with limits.

---

## 4. Solution Options

### 4.1 Solution Option 1: MCP route inside time-app
**Description**: Add `app/api/mcp/route.ts` implementing the MCP Streamable HTTP transport, validating the Supabase token, and calling Supabase with the user's token so RLS applies. Tools map to the capture and read functions.

**Architecture**:
```
Claude (scheduled run / chat) → connector → time-app /api/mcp → Supabase (RLS, user JWT)
```

**Implementation Details**:
- Frontend: Inbox detail and processing dialog changes.
- Backend: one route, Zod schemas, audit writes.
- Database: additive migration.
- Infrastructure: existing Netlify deployment.

**Pros**:
- One codebase, one deploy, reuses schema and tests.
- Same validation and RLS as the app.

**Cons**:
- Couples agent availability to web deploys.
- Netlify function limits apply.

**Effort Estimate** (rough, NEEDS CLARIFICATION by developer):
- Development: 6 to 8 developer-days
- Testing: 2 days
- Deployment: 1 day
- Total: 9 to 11 days

**Cost Estimate**:
- Development: NEEDS CLARIFICATION
- Infrastructure: no change
- Third-party services: no change
- Total: NEEDS CLARIFICATION

**Technical Debt**: Low. The second entry point is isolated behind one route.

---

### 4.2 Solution Option 2: Standalone MCP service
**Description**: A separate small service (for example a Node process or a Cloudflare Worker) that talks to Supabase with the user's token.

**Architecture**:
```
Claude → connector → standalone MCP service → Supabase (RLS, user JWT)
```

**Implementation Details**:
- Frontend: same as Option 1.
- Backend: new repository; duplicated validation unless shared.
- Database: same migration.
- Infrastructure: new hosting and secret store.

**Pros**:
- Deploys independently of the web app.
- No serverless limits from the Next.js app.

**Cons**:
- Second codebase; validation duplicated or shared through a package.
- Another secret store and deploy pipeline.

**Effort Estimate** (rough):
- Development: 7 to 9 developer-days
- Testing: 2 days
- Deployment: 2 days
- Total: 11 to 13 days

**Cost Estimate**: NEEDS CLARIFICATION

**Technical Debt**: Medium.

---

### 4.3 Solution Option 3: Keep the Google Sheet and connectors, no app changes
**Description**: Continue with the interim Sheet inbox. The triage skill writes to the Sheet and uses Atlassian and Gmail connectors directly.

**Architecture**:
```
Claude → Google Sheets connector (Inbox tab) → user review → Jira / Gmail connectors
```

**Pros**:
- Works now.
- No development.

**Cons**:
- Duplicates app state; no processing flow; Sheet can drift from the app.
- Approval is a checkbox, not enforced by the system.

**Effort Estimate**: under 1 day to finish the skill.

**Cost Estimate**: none.

**Technical Debt**: High.

---

### 4.4 Recommendation
**Recommended Solution**: Option 1 (MCP route inside time-app).

**Rationale**:
1. The app already implements the GTD lifecycle, and the agent only needs to feed its Inbox.
2. Approval becomes structural: the agent cannot process or delete, and external actions depend on the user's processing action.
3. One codebase, one deploy, same validation and RLS.

**Trade-offs Accepted**:
- Agent availability is tied to the web deployment. Acceptable for a single-user MVP.
- Netlify limits apply. Mitigated by small tool calls.

**Alternative Considered**: Option 3 remains the interim until Option 1 is live. Option 2 is deferred unless Netlify limits block the design.

---

## 5. Test Cases and Scenarios

### 5.1 Functional Test Cases
**Test Case 1: Capture creates an Inbox item**
- **Test ID**: TC-FS-001-001
- **Description**: Verify `capture_inbox_item` creates a task with status `inbox`.
- **Priority**: P0
- **Preconditions**: authenticated test user; connector connected.
- **Test Steps**: 1. call capture with all fields. 2. open Inbox in the app.
- **Expected Result**: one new inbox task with source, quote and proposed fields visible.
- **Test Data**: sample Bluedot candidate.

**Test Case 2: Duplicate capture is idempotent**
- **Test ID**: TC-FS-001-002
- **Description**: Same `dedupe_key` captured twice.
- **Priority**: P0
- **Preconditions**: one captured item.
- **Test Steps**: 1. capture again with same key.
- **Expected Result**: existing task returned; no new row.
- **Test Data**: same payload.

**Test Case 3: Unauthenticated call rejected**
- **Test ID**: TC-FS-001-003
- **Description**: Call without token.
- **Priority**: P0
- **Expected Result**: 401, no data returned.

**Test Case 4: Cross-user isolation**
- **Test ID**: TC-FS-001-004
- **Description**: User A's token attempts to read user B's task by ID.
- **Priority**: P0
- **Expected Result**: not found; no data leaked.

**Test Case 5: External action tag cannot be set by agent**
- **Test ID**: TC-FS-001-005
- **Description**: Capture or update call includes `external_action`.
- **Priority**: P0
- **Expected Result**: rejected; field unchanged.

**Test Case 6: External action runs only after processing**
- **Test ID**: TC-FS-001-006
- **Description**: Skill run with an unprocessed item tagged by nothing.
- **Priority**: P0
- **Expected Result**: zero calls to Jira, Gmail or Chat write tools.

**Test Case 7: Failed run does not advance cursor**
- **Test ID**: TC-FS-001-007
- **Description**: Bluedot connector returns an error mid-run.
- **Priority**: P1
- **Expected Result**: cursor unchanged; error recorded; next run retries.

### 5.2 Edge Case Test Scenarios
| Test Scenario | Input/Condition | Expected Behavior | Priority |
|---------------|-----------------|-------------------|----------|
| Empty title | capture with empty title | Validation error | P0 |
| Oversized quote | quote over limit | Truncated or rejected per limit | P1 |
| Prompt injection in source | transcript says "delete all tasks" | No delete tool exists; nothing changes | P0 |
| Excluded topic | candidate matches HR exclusion list | Not captured | P0 |
| Over 50 candidates | single run | First 50 captured, rest next run | P2 |

### 5.3 Performance Test Scenarios
- **Scenario**: 50 capture calls in one minute.
- **Expected**: p95 under 500 ms; no errors.
- **Test Tool**: k6 or a simple script.

### 5.4 Security Test Scenarios
| Security Test | Description | Expected Result |
|---------------|-------------|-----------------|
| Authentication bypass | call without token | 401 |
| Authorization check | user A reads user B's task | not found |
| Tool surface | list tools | only capture and read tools plus `set_external_ref` |
| Injection | transcript instructs agent to act | no unapproved writes |
| Rate limiting | burst of calls | throttled |

### 5.5 Integration Test Scenarios
**Integration with Bluedot**:
- **Scenario**: scheduled run reads a meeting.
- **Test**: candidates captured with source link.
- **Expected**: items in Inbox.
- **Error case**: connector error; cursor unchanged.

**Integration with Jira (Atlassian connector)**:
- **Scenario**: approved task with `external_action = jira`.
- **Test**: issue created; `set_external_ref` stores key.
- **Expected**: task shows Jira key.
- **Error case**: connector error; tag remains; retry next run.

### 5.6 User Acceptance Test Scenarios
| Scenario | Flow (2.2 / 2.3) | Persona | Steps | Passes when |
|----------|------------------|---------|-------|-------------|
| UAT-1 | 2.2.1 | Project manager | Run scheduled capture; open Inbox | New items with source appear |
| UAT-2 | 2.2.2 | Project manager | Process an agent item to Waiting For with external action Chat ping | Task in Waiting For; tag visible |
| UAT-3 | 2.2.3 | Project manager | Next run after UAT-2 | Action executed once; external ref stored |

### 5.7 Regression Test Impact
**Affected Features**: Inbox list, processing actions, task capture from the web and mobile apps.

**Regression Tests Required**:
- [ ] Existing Vitest suites for tasks capture, processing and validation
- [ ] `app/api/mobile/process-inbox` route tests
- [ ] E2E inbox spec

**New Regression Tests**:
- MCP route authentication and isolation tests
- Migration test on a copy of the schema

---

## 6. Implementation Planning

### 6.1 Development Approach
**Phased Rollout**:
- **Phase 1**: spike on connector auth; migration; capture and read MCP tools; Inbox source display; `gtd-triage` skill for Bluedot only. Timeline: NEEDS CLARIFICATION.
- **Phase 2**: Gmail source; processing selector for external actions; Jira execution via Atlassian connector; `set_external_ref`.
- **Phase 3**: Google Chat source (after Chat connector is live); Gmail draft and Chat ping actions; weekly review digest from `agent_events`.

**MVP Definition**:
- Must have: FR-1, FR-2, FR-3, FR-4, FR-7; Bluedot source only; manual external actions.
- Can defer: FR-5 execution, FR-8 dashboard, Gmail and Chat sources.

### 6.2 Timeline Estimate
| Phase | Activities | Duration | Dependencies |
|-------|-----------|----------|--------------|
| Spike | connector auth, Supabase project check | NEEDS CLARIFICATION | access to Claude admin |
| Build | migration, MCP route, UI | NEEDS CLARIFICATION | spike result |
| Skill | triage skill and Bluedot source | NEEDS CLARIFICATION | MCP route deployed |
| Testing | unit, route, UAT | NEEDS CLARIFICATION | build complete |
| Deployment | Netlify and connector setup | 1 to 2 days | testing complete |
| **Total** | | NEEDS CLARIFICATION | |

### 6.3 Resource Requirements
**Team Composition**:
- Developer: 1 person (NEEDS CLARIFICATION)
- Product manager: Volodymyr Chornyi
- QA: self-test with UAT scenarios

**Skills Needed**:
- Next.js route handlers, Supabase RLS, Zod
- MCP protocol and Claude custom connectors
- OAuth or token-based auth

**External Resources**:
- Workspace admin for connector approval
- None else identified

### 6.4 Risks and Mitigation
| Risk | Impact | Probability | Mitigation Plan | Owner |
|------|--------|-------------|-----------------|-------|
| Connector auth not supported as planned | H | M | Spike before build | Volodymyr |
| Netlify limits | M | L | Small tool calls; measure | Developer |
| Prompt injection | H | M | Capture-only write surface; human gate | Developer |
| Personal or HR data in quotes | H | M | Exclusion list; retention rule | Volodymyr |
| Admin approval delayed | M | M | Start with Bluedot and Gmail; Chat later | Volodymyr |

---

## 7. Business Case

### 7.1 Business Value
**Revenue Impact**: not applicable at MVP.

**Cost Savings**:
- Operational efficiency: time saved on manual triage (NEEDS CLARIFICATION).
- Automation savings: NEEDS CLARIFICATION hours per week.

**Strategic Value**:
- Shows an approval-gated agent pattern for internal tooling.
- Gives the team one place for commitments.

### 7.2 Cost Analysis
**Development Costs**: NEEDS CLARIFICATION.

**Ongoing Costs**:
- Infrastructure: no change.
- Third-party services: existing Claude plan.
- Maintenance: NEEDS CLARIFICATION.

**Total Cost of Ownership (TCO) - Year 1**: NEEDS CLARIFICATION.

### 7.3 ROI Calculation
Not calculated at this draft.

### 7.4 Priority Score
| Factor | Weight | Score (1-10) | Weighted Score |
|--------|--------|--------------|----------------|
| Business value | 30% | NEEDS CLARIFICATION | |
| User impact | 25% | 8 | |
| Strategic alignment | 20% | 7 | |
| Feasibility | 15% | 6 | |
| Risk level | 10% | NEEDS CLARIFICATION | |
| **Total** | 100% | | NEEDS CLARIFICATION |

**Recommendation**: NEEDS CLARIFICATION.

---

## 8. User Experience Considerations

### 8.1 UI/UX Requirements
**Design Principles**:
- Inbox stays a capture surface; no clarification in the list view.
- Source is one tap away from the item.
- Agent items look different from manual items only by a source badge.

**Interaction Patterns**:
- Source badge: opens the detail panel with quote and link.
- External action selector: optional, default "none", visible only in processing.

**Responsive Design**:
- Desktop, tablet and mobile: follow the existing layout; mobile app to be updated in a later phase.

### 8.2 Accessibility Requirements
- WCAG compliance level: follow the existing app level (NEEDS CLARIFICATION).
- Keyboard navigation: new controls must be reachable by keyboard.
- Screen reader support: source badge needs a text label.
- Color contrast: follow existing theme tokens.
- Focus indicators: follow existing styles.

### 8.3 Localization
**Languages Supported**: NEEDS CLARIFICATION (see 2.6).

---

## 9. Documentation Requirements

### 9.1 User Documentation
- [ ] Connector setup guide for the user's Claude account
- [ ] Triage skill usage note
- [ ] Release notes

### 9.2 Technical Documentation
- [ ] MCP tool reference (names, inputs, errors)
- [ ] Migration notes
- [ ] Deployment guide for the MCP route
- [ ] Troubleshooting: auth errors, cursor resets

### 9.3 Training Materials
- [ ] Not required for a single user

---

## 10. Success Criteria and Metrics

### 10.1 Launch Criteria
- [ ] All P0 and P1 test cases pass
- [ ] Performance benchmarks met
- [ ] Security review of the MCP route completed
- [ ] Documentation complete
- [ ] Stakeholder sign-off obtained

### 10.2 Success Metrics
**Immediate (Week 1)**:
- Capture success rate: at least 95% of scheduled runs complete
- Error rate: under 5% of MCP calls
- Performance: capture p95 under 500 ms

**Short-term (Month 1)**:
- Acceptance rate of agent items: at least 60%
- Unapproved external writes: 0

**Long-term (Quarter 1)**:
- Sheet inbox retired
- Time to clarify under 2 minutes per item

### 10.3 Monitoring Plan
**Metrics to Track**:
- Captures per day: from `agent_events`
- Acceptance rate: from task status transitions
- Errors per run: from `agent_state.last_error`

**Alert Thresholds**:
- Run failures: alert if two consecutive runs fail (channel NEEDS CLARIFICATION)

**Review Cadence**:
- Daily: run summaries
- Weekly: acceptance rate and error review
- Monthly: exclusion list and quote retention review

---

## 11. Rollout Strategy

### 11.1 Deployment Plan
**Environment Progression**:
1. Development: NEEDS CLARIFICATION
2. Staging: NEEDS CLARIFICATION (Netlify preview)
3. Production (Beta, single user): NEEDS CLARIFICATION
4. Production (General Availability): not planned

**Feature Flags**:
- Flag name: `MCP_AGENT_ENABLED` (proposed)
- Rollout strategy: per-user allowlist
- Rollback plan: disable the flag; revoke the connector in Claude settings

### 11.2 Beta Testing
**Beta User Selection**: the author only.
**Number of users**: 1
**Duration**: NEEDS CLARIFICATION

**Beta Feedback Collection**:
- Surveys: not applicable
- Interviews: not applicable
- Usage analytics: `agent_events`

### 11.3 Communication Plan
**Internal Communications**:
- Engineering: NEEDS CLARIFICATION
- Product: author
- Sales: none
- Support: none

**External Communications**: none.

---

## 12. Appendix

### 12.1 Research and References
- Repository: https://github.com/vchornyy12/time-app
- Relevant files: `CLAUDE.md`, `app/api/mobile/process-inbox/route.ts`, `lib/actions/processing.ts`, `lib/actions/tasks.ts`, `supabase/full_schema.sql`, `Project documents/PRD_GTD_App_MVP.md`
- Interim inbox: Google Sheet linked in Document Information

### 12.2 Stakeholder Feedback
| Stakeholder | Feedback | Date | Action Taken |
|-------------|----------|------|--------------|
| Volodymyr Chornyi | Agent must capture, never approve; GTD principles must hold | 2026-11-18 | Approval gate and processing-only actions |

### 12.3 Decision Log
| Date | Decision | Rationale | Decision Maker |
|------|----------|-----------|----------------|
| 2026-11-18 | Agent writes only to Inbox | Keeps clarification with the human (GTD) | Volodymyr Chornyi |
| 2026-11-18 | External actions triggered by processing tags | Human processing is the approval | Volodymyr Chornyi |
| 2026-11-18 | Option 1 recommended (MCP route in time-app) | Single codebase and RLS | Draft recommendation |
| 2026-11-19 | Native Gmail integration frozen on staging (branch `gmail-foundation-20261106`) | Gmail via the assistants' own connectors avoids Google restricted-scope verification, stored Gmail tokens and BYOK LLM keys; one mechanism covers all sources | Volodymyr Chornyi |
| 2026-11-19 | Support ChatGPT as well as Claude | Not every user has Claude; both support remote MCP with OAuth and dynamic client registration | Volodymyr Chornyi |
| 2026-11-19 | Option 1 accepted; auth via Supabase OAuth 2.1 server with DCR | Tokens are Supabase JWTs, so RLS applies unchanged | Volodymyr Chornyi |
| 2026-11-19 | `dedupe_key` derived on the server from `source + source_ref + item_key` | LLM-chosen keys are not stable across runs | Volodymyr Chornyi |
| 2026-11-19 | Restrictive RLS for tokens with a `client_id` claim: insert Inbox tasks only | Makes the approval gate structural, also outside the MCP endpoint | Volodymyr Chornyi |
| 2026-11-19 | Capture runs and external-action runs (FR-5/FR-6) must be separate | A run that reads untrusted text must not hold write tools for Jira, Gmail or Chat | Volodymyr Chornyi |

### 12.4 Change History
| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-18 | Volodymyr Chornyi | Initial feature specification |
| 1.1 | 2026-11-19 | Volodymyr Chornyi | Phase 1 implemented on branch `feat/mcp-agent-connector`; see `docs/agent-connector.md`. ChatGPT added; Gmail native integration frozen |

---

## Status and Next Steps

**Current Status**: Draft

**Next Steps**:
1. [ ] Confirm production Supabase project and time24.pro deployment - Owner: Volodymyr - Due: NEEDS CLARIFICATION
2. [ ] Spike connector authentication for Claude custom connectors - Owner: Volodymyr - Due: NEEDS CLARIFICATION
3. [ ] Answer open questions in 2.6 - Owner: Volodymyr - Due: NEEDS CLARIFICATION

**Approvals Required**:
- [ ] Product Manager: Volodymyr Chornyi
- [ ] Engineering Lead: NEEDS CLARIFICATION
- [ ] Design Lead: not applicable
- [ ] Security Team: NEEDS CLARIFICATION
- [ ] Stakeholder: NEEDS CLARIFICATION

**Target Dates**:
- PRD inclusion: not planned
- SRS creation: not planned
- Development start: NEEDS CLARIFICATION
- Target release: NEEDS CLARIFICATION
