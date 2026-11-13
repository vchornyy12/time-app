# Gmail incremental scan handoff

Updated: 2026-11-13

This is the current handoff for agents continuing Gmail scan work. It describes
the incremental-scan implementation and release state; earlier notes in
`gmail-ai-implementation-plan.md` and `gmail-inbox.md` may predate this work.

## Behavior

- A user's first successful scan starts at the newest messages in `in:inbox`.
  The user-selected scan limit (25, 50, 100, or 500) caps the run; the worker
  analyzes up to five messages per request until it reaches that limit.
- Later scans search `in:inbox after:<unix-seconds>` using the last successful
  scan cursor. Previously processed, currently processing, and dismissed or
  otherwise terminal ledger entries are not re-enqueued.
- All newly received message IDs are entered into the processing ledger before
  analysis. Messages beyond the selected limit remain eligible for a later
  scan, so they are not lost when there is a large backlog of new mail.
- The cursor advances only after the scan run is marked completed. Failed or
  interrupted runs retain the old cursor and can discover their messages again.
- Gmail content is still sent to the user's connected OpenAI API key only after
  the scan consent checkbox is selected. Suggestions remain review-only until
  the user accepts them.

## Implementation map

- `lib/gmail/messages.ts` — first-scan retrieval, incremental Gmail query,
  eligibility ledger, batch loading, and cursor persistence helper.
- `lib/gmail/analyzer.ts` — analysis now consumes the scan-specific retrieval
  path rather than the general preview retrieval path.
- `app/api/gmail/scan-worker/route.ts` — persists the cursor after the run
  completes successfully.
- `components/tasks/GmailInboxScanner.tsx` — explains first-scan and later-scan
  behavior to the user.
- `supabase/migrations/20261114000000_gmail_incremental_scans.sql` — adds
  `gmail_integrations.scan_cursor_at`,
  `gmail_processed_messages.incremental_eligible`, the `skipped` ledger state,
  and the supporting partial index. It backfills connected integrations from
  their latest completed run and marks legacy pending/failed rows skipped so
  old historical backlog is not mistaken for newly received mail. Newly found
  IDs in a later scan window are checked against Gmail `internalDate` and the
  `INBOX` label before legacy rows can be reactivated.

## Tests and validation

- `lib/gmail/messages.test.ts` covers the initial newest-first limit,
  incremental `after:` filtering, deduplication of previously scanned mail,
  retention of new-mail overflow, exclusion of historical pending mail, and
  cursor stability while a scan is running. Gmail API and Supabase calls are
  mocked; these tests do not read a real mailbox or call an LLM.
- `components/settings/GmailInboxCard.test.tsx` was updated to reflect the
  current connection and scan-schedule UI; it previously asserted a removed
  label editor.
- Validation run from the workspace: `npm run test:run` — 478 tests passed;
  `npm run build` — passed. The initial full-suite run found three failures in
  the stale settings test; after updating that test, the full suite passed.

## Release state

- Owner confirmed that the incremental-scan migration executed successfully in
  the shared Supabase project on 2026-11-13. Do not apply the same migration a
  second time.
- Runtime change was deployed to the staging branch at
  `https://gmail-foundation-20261106--time2go.netlify.app`, Netlify deploy
  `6af6e756b89840347e02fa64`, commit `97633b9b120e461e447baa45875ba222d8c015fc`.
  Netlify reported the deploy ready. The owner subsequently confirmed staging
  behavior works.
- Tests are on staging branch commit `75cda4c` (test-only relative to the
  deployed runtime commit). This handoff documents the current status.
  Production has not been deployed by this work.
- Google Cloud has the Gmail API enabled and the app requests
  `https://www.googleapis.com/auth/gmail.readonly`. Google classifies this as a
  restricted scope. The owner reported Branding verified; the Data Access
  screen showed Gmail approval still required. The demo video, scope review,
  and any Google-required security assessment remain outstanding. Do not
  describe Gmail scope verification as complete.

## Production rollout plan

1. Confirm the production Netlify site points at the intended release branch
   and that the production environment has the existing Gmail, Supabase, and
   background-worker settings. Verify staging and production really share the
   database before relying on the already-applied migration.
2. Merge the tested Gmail changes and tests to the production release branch.
   The latest code commit includes Gmail review hover feedback and incremental
   scanning; the follow-up commit adds tests and documentation.
3. Deploy through the normal production Netlify workflow. Do not re-run the
   migration on the shared database.
4. Use a controlled mailbox for a smoke check: complete one scan, then send a
   new message and confirm the next scan surfaces only mail since the prior
   completed scan. Confirm suggestions still require user review. Only run an
   LLM-backed smoke check after explicitly consenting in the app.
5. Submit the production OAuth app for Google's `gmail.readonly` restricted
   scope verification with the accurate justification and an English-language
   demo showing the OAuth grant, consent to scan/send content to OpenAI, and
   suggestion review. Google says restricted-scope apps accessing user data
   through a server must complete a security assessment; verify its current
   requirements and completion before broad public Gmail access.
6. Monitor Netlify worker logs and scan-run status. Roll back the production
   deploy if scans fail; keep the prior database schema because the migration
   is additive.

Google references:

- [Restricted scopes](https://support.google.com/cloud/answer/13464325?hl=en)
- [OAuth verification submission](https://support.google.com/cloud/answer/13461325?hl=en)
- [Security assessment](https://support.google.com/cloud/answer/13465431?hl=en)
