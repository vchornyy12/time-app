# AI assistant connector (Claude, ChatGPT)

Implements FS-001 phase 1. Claude or ChatGPT reads the user's sources through
their own connectors (Gmail, Bluedot, …) and captures candidate action items
into the Time24 Inbox through a remote MCP server at `/api/mcp`. The user
processes every item in the app.

## How it fits together

```
Claude / ChatGPT ──(OAuth 2.1, DCR)──► Supabase Auth OAuth server ──► /oauth/consent (Time24)
        │
        └──(Bearer access token)──► POST /api/mcp ──► Supabase (user's token, RLS)
```

- **Discovery.** `/api/mcp` answers unauthenticated calls with 401 and
  `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/api/mcp"`.
  That document names Supabase Auth (`https://<ref>.supabase.co/auth/v1`) as the
  authorization server. Clients register themselves (DCR), send the user to
  `/oauth/consent`, and receive a Supabase access token.
- **Tokens.** Access tokens are Supabase JWTs with a `client_id` claim. The
  endpoint accepts only tokens with that claim, so ordinary app sessions cannot
  call it. Queries run with the user's token, so RLS applies.
- **Tools.** Capture: `capture_inbox_item`. Read: `list_inbox`, `list_next_actions`,
  `list_waiting_for`, `get_task`, `get_agent_profile`, `list_suggestions`,
  `list_recent_outcomes`. Run state: `get_source_cursor`, `set_source_cursor`,
  `filter_unprocessed`, `mark_processed`. Proposals: `propose_task_update`,
  `list_approved_actions`, `complete_approved_action`. Notify: `notify_user`.
  Google Chat (read-only): `chat_messages_since`, `chat_list_messages`,
  `chat_recent_conversations`. No tool processes, completes, moves or deletes a task.
- **Database limits** (migration `20261119000000_agent_capture.sql`): restrictive
  RLS policies make any token with a `client_id` claim insert-only, and only
  for Inbox tasks; every other user table is read-only for it. This holds even
  if a token is used directly against the Supabase Data API.
- **Deduplication.** The server derives `dedupe_key` from
  `source + source_ref + item_key`; `(user_id, dedupe_key)` is unique. Capturing
  the same item again returns the existing task.
- **Audit.** Writes are logged in `agent_events` (user, client, tool, task, result).
  Settings shows the last activity and the captures in the last 7 days.
- **Instructions.** The server's `initialize` response carries short triage rules,
  so both Claude and ChatGPT get them without a skill. The fuller rules are in
  `agent/skills/gtd-triage/SKILL.md`.

## Setup (once per environment)

1. Apply `supabase/migrations/20261119000000_agent_capture.sql`.
2. Supabase dashboard → **Authentication → OAuth Server**:
   - enable the OAuth 2.1 server;
   - enable **dynamic client registration** (Claude and ChatGPT both register themselves);
   - **Authorization path**: `/oauth/consent`.
   The **Site URL** (Authentication → URL Configuration) must be the public app
   origin, because Supabase sends users to `<Site URL>/oauth/consent`.
3. Server environment:
   - `MCP_AGENT_ENABLED=true` (without it `/api/mcp` and the metadata return 404);
   - `APP_ORIGIN=https://time24.pro` (bare origin; needed where the host exposes
     deploy-specific hostnames, e.g. Netlify branch deploys).
4. Verify: `curl -i -X POST https://<origin>/api/mcp -H 'content-type: application/json' -d '{}'`
   returns 401 with the `WWW-Authenticate` header, and
   `curl https://<origin>/.well-known/oauth-protected-resource/api/mcp` returns the metadata.

## Connecting

The connector URL is shown in **Settings → Integrations → AI assistants**:
`https://<origin>/api/mcp`.

- **Claude** (web, desktop, mobile): Settings → Connectors → Add custom connector →
  paste the URL, leave OAuth client fields empty → Connect → sign in → Allow.
  Callback used by Claude: `https://claude.ai/api/mcp/auth_callback`.
  On Team/Enterprise an owner may need to add the connector for the organisation.
  Add the `gtd-triage` skill (upload `agent/skills/gtd-triage`) for the full rules.
- **ChatGPT**: Settings → Apps & Connectors → Advanced → Developer mode on →
  Create → paste the URL, authentication OAuth → sign in → Allow.
  On Business/Enterprise an admin may need to allow custom connectors.
  Paste the body of `SKILL.md` into the project or task instructions.

### Scheduled runs

- Claude: create a scheduled task, e.g. "Run gtd-triage for Gmail and Bluedot",
  working days every 2 hours.
- ChatGPT: create a Task with the same prompt.

Both need the Gmail/Bluedot connectors enabled in the same account.

## Security notes and limits

- Any OAuth client can register (DCR is open by design for MCP); the consent
  page is the gate. It shows the client name and return host; approve only
  connections you started.
- Revoking: remove the connector in Claude/ChatGPT. Supabase grants can also be
  revoked in the dashboard (OAuth Server → clients).
- Supabase does not support RFC 8707 resource indicators yet, so tokens are not
  audience-bound to `/api/mcp`. The `client_id` restrictive policies limit what a
  leaked token can do.
- Storage: agent tokens cannot upload, change or delete objects; they can still
  read the user's own attachments through the Storage API. No MCP tool exposes storage.
- No rate limiting on `/api/mcp` yet (single-user MVP).

## Tests

- `npx vitest run lib/mcp app/api/mcp --no-file-parallelism`
- `node scripts/test-agent-capture-migration.mjs /path/to/@electric-sql/pglite/dist/index.js`
  (applies the migration to in-memory Postgres and checks the RLS limits).

## PM assistant (migration `20261120000000_pm_assistant.sql`)

The user lives by GTD: the agent collects, the user decides.

| Piece | What it does |
| --- | --- |
| `agent_processed_items` | Ledger of source items already handled (captured, noise, closed, duplicate). Hourly runs call `filter_unprocessed` and analyse only new IDs. Captures are recorded automatically. |
| `agent_suggestions` | Agent proposals on existing tasks: `close`, `follow_up` (with a draft message), `jira_issue`. Shown at the top of the Inbox; the user accepts or dismisses. Accepting `close` marks the task done; accepting `jira_issue` queues it, and the agent creates the issue on its next run and records the key through `complete_agent_suggestion` (the only state change an agent token can make). |
| `agent_profiles` | The user's standing instructions and muted conversations, edited in Settings → Assistant. Read-only for agents. |
| `assistant_integrations` + Vault | Google Chat refresh token and the notification webhook URL, encrypted; readable only by the service role. Users see connection flags only. |

### Google Chat source (REST API)

Google's hosted Chat MCP needs Developer Preview access, so Time24 reads Chat
through the generally available Chat REST API with the user's own grant.

1. Google Cloud project with **Google Chat API** and **People API** enabled.
2. OAuth client (Web application). Authorized redirect URIs:
   `https://time24.pro/api/google-chat/callback` (and `http://localhost:3000/api/google-chat/callback` for development).
3. OAuth consent screen: Internal (Workspace). Scopes: `chat.spaces.readonly`,
   `chat.messages.readonly`, `chat.memberships.readonly`, `directory.readonly`, `openid`, `email`.
4. Server env: `GOOGLE_CHAT_CLIENT_ID`, `GOOGLE_CHAT_CLIENT_SECRET`.
5. User: Settings → Assistant → Connect Google Chat.

### Notifications

Google Chat incoming webhook in a space of the user's own ("Time24 Assistant"):
space → Apps & integrations → Webhooks → Add webhook → paste the URL in
Settings → Assistant. Time24 sends a test message before saving. `notify_user`
allows 30 messages a day; the skill uses it for the morning digest, the weekly
review and urgent items only.

### Schedule

Claude scheduled task (cloud), working days, Europe/Warsaw time:

- hourly 08:00–17:00 — `gtd-triage` capture (08:00 run is the morning mode: capture,
  follow-ups, approved Jira actions, digest);
- Friday 16:30 — weekly review.

Needs the Time24, Gmail, Bluedot and Atlassian connectors in the same Claude account.

### Tests

- `npx vitest run lib/mcp lib/assistant app/api/google-chat --no-file-parallelism`
- `node scripts/test-pm-assistant-migration.mjs /path/to/@electric-sql/pglite/dist/index.js`

### Local alternative

`agent/google-chat-mcp/` is a local stdio MCP server with the same Chat tools,
for Claude Code on a laptop before the server-side source is deployed.
