# Gmail inbox implementation

## How it works

A separate Gmail consent flow stores an encrypted refresh token in Supabase
Vault. Settings shows the mailbox, a Connected badge, and scan preferences
(manual, daily, or twice daily; 25/50/100/500 messages per scan). Scanning and
suggestion review live in the app Inbox.

- **First scan** walks `in:inbox` newest-first up to the selected limit,
  including mail that predates the connection. **Later scans** list only mail
  received since the last completed scan (`scan_cursor_at`); overflow above the
  limit stays queued for the next scan.
- New mail is listed once per run, by its first batch. The background worker
  then drains the queue five messages at a time.
- Spam and Trash are never read. Attachments are never downloaded. The body is
  the `text/plain` part, or the `text/html` part reduced to text when a message
  has no plain-text alternative. Text is bounded per message.
- Email text, subject, and sender are sent to the provider the user connected (OpenAI or Anthropic, their own API key; see `lib/llm/models.ts` for the model list) only
  after explicit consent (per manual scan, or the saved automatic-scan
  consent). Suggestions are stored without email bodies and create a task only
  when the user accepts them.

### Processing ledger

`gmail_processed_messages` holds one row per app user, Gmail account, and
message ID:

| Status | Meaning |
| --- | --- |
| `pending` | Queued for analysis. |
| `processing` | Claimed by a worker (`claimed_at` set), or analyzed and waiting for the user to accept/dismiss its suggestion. |
| `processed` | Finished: no task found, nothing to analyze, or suggestion decided. |
| `failed` | Analysis failed; retried while `attempts < 3`. |
| `skipped` | Deleted from Gmail before analysis, or legacy backlog. |

Failure handling:

- A message deleted from Gmail after queueing is marked `skipped`; other Gmail
  errors fail the run and leave the queue untouched for the next scan.
- Provider (OpenAI or Anthropic) key, billing, rate-limit, and timeout failures fail the run but do
  **not** consume a message's retry attempts. Unusable model output does.
- A claim older than ten minutes with no suggestion belongs to a worker that
  was killed mid-batch; the next batch returns it to the queue.

### Server configuration

1. Apply the Gmail migrations in order after the existing Vault migrations:
   `20261106000000`, `20261110000000`, `20261111000001`, `20261112000000`,
   `20261113000000`, `20261114000000`, `20261116000000`, `20261116000001`. Back up and follow the normal database release process.
2. Create a dedicated Google Cloud project and web OAuth client for Gmail.
   Keep this separate from the Calendar project: Google token revocation can
   affect other grants for the same project. Enable the Gmail API.
3. Register `https://YOUR_HOST/api/gmail/callback` as an authorized redirect URI
   (and `http://localhost:3000/api/gmail/callback` for local development).
4. Configure the OAuth consent screen for `gmail.readonly`, adding test users
   while in testing. This is a restricted scope; public rollout needs the
   applicable Google verification and potentially a security assessment.
5. Set server-only `GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, and
   `GMAIL_INBOX_ENABLED=true`. The existing `SUPABASE_SERVICE_ROLE_KEY` is required.
   Set server-only `GMAIL_WORKER_SECRET` to a long random value (for example
   `openssl rand -base64 48`); the scheduler, background function, and worker
   routes authenticate each other with it. If it is unset they fall back to
   the service-role key, which should not be used as an HTTP bearer token.
   The worker is addressed through `APP_ORIGIN` (or `GMAIL_APP_ORIGIN`), which
   must be a bare `https://` origin.
   Leave the flag unset until the migration and credentials are ready.
   On hosting adapters that expose immutable deploy hostnames, also set
   server-only `GMAIL_APP_ORIGIN` to the registered public origin (no path).
   For staging, scope all Gmail variables to its branch only. Consent and token
   exchange must use the same registered callback origin.
6. Connect Gmail in Settings. The app requests read access only and scans the
   Inbox without requiring a Gmail label.

Gmail's read scope permits broader mailbox access than the app uses.
Reconnecting the same account preserves its ledger and scan cursor; changing
Gmail accounts starts over. Disconnect removes/revokes credentials but retains
settings and processing history; deleting the app account cascades both and
removes the Vault secret.

## Open items

Current release state and the production rollout plan are in
[`gmail-incremental-scan-handoff.md`](gmail-incremental-scan-handoff.md).
Privacy disclosures and Google's restricted-scope verification must be complete
before Gmail is enabled for public production users.

## Verification

- `npx vitest run lib/gmail app/api/gmail lib/actions/gmail.test.ts --no-file-parallelism`
- `node scripts/test-gmail-foundation.mjs /path/to/@electric-sql/pglite/dist/index.js`
- `npx tsc --noEmit`

The isolated SQL test uses a Vault stub to check permissions and lifecycle,
not encryption. A live OAuth smoke test requires configured Google credentials.

References: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes),
[message filtering](https://developers.google.com/workspace/gmail/api/guides/filtering),
[Google token revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke).
