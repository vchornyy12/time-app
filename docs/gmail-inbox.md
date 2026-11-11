# Gmail inbox implementation

## Step 1: connection and filter foundation

Implemented: a separate Gmail consent flow, encrypted refresh-token storage in
Supabase Vault, owner-only settings, and a processing ledger keyed by app user,
Gmail account email, and message ID. The Settings card shows the mailbox and a
Connected badge. The manual Inbox scan can include messages already present when
the integration is connected; it excludes Spam and Trash, reads at most 20
messages per retrieval, extracts plain text only, and does not download
attachments. AI analysis requires explicit consent, and suggestions require
review before tasks are created.

### Server configuration

1. Apply `supabase/migrations/20261106000000_gmail_inbox_foundation.sql` after
   the existing Vault migrations. Back up and follow the normal database release process.
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
   Leave the flag unset until the migration and credentials are ready.
   On hosting adapters that expose immutable deploy hostnames, also set
   server-only `GMAIL_APP_ORIGIN` to the registered public origin (no path).
   For staging, scope all Gmail variables to its branch only. Consent and token
   exchange must use the same registered callback origin.
6. Connect Gmail in Settings. The app requests read access only and scans the
   Inbox without requiring a Gmail label.

The inbox query excludes Spam and Trash. Gmail's read scope permits broader
mailbox access than the app uses. Email bodies are read only after the user
manually starts retrieval or analysis.

The eligibility boundary is the first successful connection time. Reconnecting
the same account preserves that boundary and its ledger. Changing Gmail accounts
starts a new boundary. Disconnect removes/revokes credentials but retains
settings and processing history; deleting the app account cascades both and
removes the Vault secret.

## Next steps

1. Apply `supabase/migrations/20261111000001_gmail_task_suggestions.sql` before
   deploying the persistent suggestion review flow.
2. Complete staging migration/deployment and verify whole-Inbox retrieval,
   consent, persisted suggestions, task acceptance/dismissal, and retry behavior.
3. Update privacy disclosures and complete Google verification before enabling
   Gmail AI analysis for public production users. Scans remain manual; no scheduler
   is enabled.

## Verification

- `npx vitest run app/api/gmail/callback/route.test.ts lib/actions/gmail.test.ts`
- `node scripts/test-gmail-foundation.mjs /path/to/@electric-sql/pglite/dist/index.js`
- `npx tsc --noEmit`

The isolated SQL test uses a Vault stub to check permissions and lifecycle,
not encryption. A live OAuth smoke test requires configured Google credentials.

References: [Gmail scopes](https://developers.google.com/workspace/gmail/api/auth/scopes),
[message filtering](https://developers.google.com/workspace/gmail/api/guides/filtering),
[Google token revocation](https://developers.google.com/identity/protocols/oauth2/web-server#tokenrevoke).
