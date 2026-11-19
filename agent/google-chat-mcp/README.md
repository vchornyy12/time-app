# Google Chat (REST) — local MCP server

Read-only Google Chat access for the `gtd-triage` agent, through the generally
available Chat REST API. Google's hosted Chat MCP (`chatmcp.googleapis.com`)
needs Developer Preview access; this server does not.

Runs locally over stdio (Claude Code / Claude Desktop). No dependencies, Node 22+.

## Tools

| Tool | Use |
| --- | --- |
| `chat_recent_conversations(limit, types)` | Most recently active spaces, group chats and DMs, with the last message |
| `chat_list_messages(space, since, until, limit)` | One conversation, oldest first (default: last 2 days) |
| `chat_messages_since(since, …)` | Every conversation active after a cursor; returns `newest_message_at` for `set_source_cursor` |

## Setup

1. Google Cloud project: enable **Google Chat API** and **People API** (names of DM partners).
2. OAuth client (Web application) with redirect URI `http://localhost:8765/callback`.
3. Put the client in `~/.config/time24-chat/client.json` (mode 600):
   ```json
   { "client_id": "…apps.googleusercontent.com", "client_secret": "…" }
   ```
4. Sign in once: `node agent/google-chat-mcp/auth.mjs` — saves a refresh token to
   `~/.config/time24-chat/token.json` (mode 600).
5. Register: `claude mcp add -s user google-chat-rest -- node "$PWD/agent/google-chat-mcp/server.mjs"`

Scopes: `chat.spaces.readonly`, `chat.messages.readonly`, `chat.memberships.readonly`,
`directory.readonly`, `openid email profile`. Nothing is written to Chat.

Without the People API, senders appear as `users/<id>`.
