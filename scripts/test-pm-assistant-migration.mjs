// Applies the agent-capture and PM-assistant migrations to an in-memory Postgres
// (PGlite) with stubbed Supabase auth and Vault, then checks the RLS limits.
// Usage: node scripts/test-pm-assistant-migration.mjs /path/to/@electric-sql/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite')
const db = new PGlite()
const alice = '11111111-1111-4111-8111-111111111111'
const bob = '22222222-2222-4222-8222-222222222222'

async function as(sub, claims, fn) {
  const jwt = JSON.stringify({ sub, role: 'authenticated', ...claims })
  await db.exec(`SET ROLE authenticated; SELECT set_config('request.jwt.claims', '${jwt}', false);`)
  try { return await fn() } finally { await db.exec('RESET ROLE;') }
}
const app = (fn) => as(alice, {}, fn)
const agent = (fn) => as(alice, { client_id: 'claude-client' }, fn)
const one = async (sql) => (await db.query(sql)).rows[0]

try {
  await db.exec(`
    CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.jwt() RETURNS jsonb LANGUAGE sql STABLE AS $$
      SELECT coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT (auth.jwt() ->> 'sub')::uuid $$;
    GRANT USAGE ON SCHEMA public, auth TO anon, authenticated, service_role;
    GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA auth TO authenticated;
    INSERT INTO auth.users VALUES ('${alice}'), ('${bob}');
    -- Vault stub: plaintext table with the same API.
    CREATE SCHEMA vault;
    CREATE TABLE vault.secrets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), secret text NOT NULL);
    CREATE VIEW vault.decrypted_secrets AS SELECT id, secret AS decrypted_secret FROM vault.secrets;
    CREATE FUNCTION vault.create_secret(s text) RETURNS uuid LANGUAGE sql AS $$ INSERT INTO vault.secrets(secret) VALUES (s) RETURNING id $$;
    CREATE FUNCTION vault.update_secret(i uuid, s text) RETURNS void LANGUAGE sql AS $$ UPDATE vault.secrets SET secret = s WHERE id = i $$;
    CREATE TYPE task_status AS ENUM ('inbox','next_actions','waiting_for','calendar','someday_maybe','notes','trash','done');
    CREATE TABLE tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
      title text NOT NULL, status task_status NOT NULL DEFAULT 'inbox');
    ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tasks_all ON tasks FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    GRANT SELECT, INSERT, UPDATE, DELETE ON tasks TO authenticated;
  `)
  await db.exec(await readFile('supabase/migrations/20261119000000_agent_capture.sql', 'utf8'))
  const migration = await readFile('supabase/migrations/20261120000000_pm_assistant.sql', 'utf8')
  await db.exec(migration)
  await db.exec(migration) // idempotent re-run

  const aliceTask = (await one(`INSERT INTO tasks(user_id,title,status) VALUES ('${alice}','Get build from Oleh','waiting_for') RETURNING id`)).id
  const bobTask = (await one(`INSERT INTO tasks(user_id,title,status) VALUES ('${bob}','Bob task','waiting_for') RETURNING id`)).id

  // ── Ledger: agent can record and update its own items, not delete or touch others.
  await agent(async () => {
    await db.exec(`INSERT INTO agent_processed_items(user_id,source,source_ref,outcome) VALUES ('${alice}','gmail','m1','noise')`)
    await db.exec(`INSERT INTO agent_processed_items(user_id,source,source_ref,outcome) VALUES ('${alice}','gmail','m1','captured')
      ON CONFLICT (user_id,source,source_ref) DO UPDATE SET outcome = excluded.outcome`)
    assert.equal((await one(`SELECT outcome FROM agent_processed_items WHERE source_ref='m1'`)).outcome, 'captured')
    assert.equal((await db.query(`DELETE FROM agent_processed_items RETURNING source_ref`)).rows.length, 0, 'agent cannot delete ledger rows')
    await assert.rejects(db.exec(`INSERT INTO agent_processed_items(user_id,source,source_ref,outcome) VALUES ('${bob}','gmail','m1','noise')`), /row-level security/)
    await assert.rejects(db.exec(`INSERT INTO agent_processed_items(user_id,source,source_ref,outcome) VALUES ('${alice}','gmail','m2','done')`), /check constraint/)
  })

  // ── Suggestions: agent may insert pending ones on its user's tasks only, never decide them.
  let suggestion
  await agent(async () => {
    suggestion = (await one(`INSERT INTO agent_suggestions(user_id,task_id,kind,reason,payload)
      VALUES ('${alice}','${aliceTask}','jira_issue','Track in Jira','{"project_key":"N30","summary":"Get build"}') RETURNING id`)).id
    await assert.rejects(db.exec(`INSERT INTO agent_suggestions(user_id,task_id,kind,reason) VALUES ('${alice}','${aliceTask}','jira_issue','again')`), /agent_suggestions_one_pending_idx/)
    await assert.rejects(db.exec(`INSERT INTO agent_suggestions(user_id,task_id,kind,reason) VALUES ('${alice}','${bobTask}','close','not mine')`), /row-level security/)
    await assert.rejects(db.exec(`INSERT INTO agent_suggestions(user_id,task_id,kind,reason,status,decided_at) VALUES ('${alice}','${aliceTask}','close','pre-approved','accepted',now())`), /row-level security/)
    await assert.rejects(db.exec(`INSERT INTO agent_suggestions(user_id,task_id,kind,reason,evidence_url) VALUES ('${alice}','${aliceTask}','close','x','javascript:alert(1)')`), /check constraint/)
    assert.equal((await db.query(`UPDATE agent_suggestions SET status='accepted', decided_at=now() RETURNING id`)).rows.length, 0, 'agent cannot accept')
    assert.equal((await db.query(`DELETE FROM agent_suggestions RETURNING id`)).rows.length, 0, 'agent cannot delete')
    // Not approved yet: the agent cannot record an execution.
    await assert.rejects(db.exec(`SELECT public.complete_agent_suggestion('${suggestion}', true, 'N30-1')`), /No approved action/)
  })

  // The human accepts in the app; then the agent records the Jira key.
  await app(async () => {
    assert.equal((await db.query(`UPDATE agent_suggestions SET status='accepted', decided_at=now() WHERE id='${suggestion}' RETURNING id`)).rows.length, 1)
  })
  await as(bob, { client_id: 'claude-client' }, async () => {
    await assert.rejects(db.exec(`SELECT public.complete_agent_suggestion('${suggestion}', true, 'N30-9')`), /No approved action/)
  })
  await agent(async () => {
    await db.exec(`SELECT public.complete_agent_suggestion('${suggestion}', true, 'N30-200')`)
    const row = await one(`SELECT status, external_ref FROM agent_suggestions WHERE id='${suggestion}'`)
    assert.deepEqual(row, { status: 'executed', external_ref: 'N30-200' })
    await assert.rejects(db.exec(`SELECT public.complete_agent_suggestion('${suggestion}', true, 'N30-201')`), /No approved action/)
  })

  // ── Profile: the user edits it, the agent only reads it.
  await app(async () => {
    await db.exec(`INSERT INTO agent_profiles(user_id,instructions,muted) VALUES ('${alice}','Ignore INVOICES check','{"Kudos Hub"}')`)
  })
  await agent(async () => {
    assert.equal((await one(`SELECT instructions FROM agent_profiles`)).instructions, 'Ignore INVOICES check')
    assert.equal((await db.query(`UPDATE agent_profiles SET instructions='capture nothing' RETURNING user_id`)).rows.length, 0)
    assert.equal((await db.query(`DELETE FROM agent_profiles RETURNING user_id`)).rows.length, 0)
  })

  // ── Secrets: only the service role can read or write them; users see flags only.
  await db.exec(`SET ROLE service_role`)
  await db.exec(`SELECT public.set_assistant_secret('${alice}','chat','refresh-1','alice@example.com')`)
  await db.exec(`SELECT public.set_assistant_secret('${alice}','notify','https://chat.googleapis.com/v1/spaces/A/messages?key=k&token=t')`)
  await db.exec(`SELECT public.set_assistant_secret('${alice}','chat','refresh-2')`)
  assert.equal((await one(`SELECT public.get_assistant_secret('${alice}','chat') AS s`)).s, 'refresh-2')
  await db.exec('RESET ROLE')
  assert.equal((await one(`SELECT count(*)::int AS n FROM vault.secrets`)).n, 2, 'rotation reuses the secret')
  await app(async () => {
    const flags = await one(`SELECT chat_connected, notify_connected FROM assistant_integrations`)
    assert.deepEqual(flags, { chat_connected: true, notify_connected: true })
    await assert.rejects(db.exec(`SELECT chat_token_secret_id FROM assistant_integrations`), /permission denied/)
    await assert.rejects(db.exec(`SELECT public.get_assistant_secret('${alice}','chat')`), /permission denied/)
    await assert.rejects(db.exec(`SELECT public.set_assistant_secret('${alice}','chat','x')`), /permission denied/)
  })
  await agent(async () => {
    await assert.rejects(db.exec(`SELECT public.get_assistant_secret('${alice}','notify')`), /permission denied/)
  })
  await db.exec(`SET ROLE service_role`)
  await db.exec(`SELECT public.clear_assistant_secret('${alice}','chat')`)
  await db.exec('RESET ROLE')
  assert.equal((await one(`SELECT count(*)::int AS n FROM vault.secrets`)).n, 1, 'disconnect deletes the secret')
  await db.exec(`DELETE FROM public.assistant_integrations WHERE user_id='${alice}'`)
  assert.equal((await one(`SELECT count(*)::int AS n FROM vault.secrets`)).n, 0, 'row deletion cleans up secrets')

  // ── Isolation.
  await as(bob, {}, async () => {
    assert.equal((await db.query('SELECT * FROM agent_processed_items')).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM agent_suggestions')).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM agent_profiles')).rows.length, 0)
  })
  console.log('pm assistant migration: all checks passed')
} catch (e) {
  console.error('FAILED:', e.message)
  console.error(String(e.stack).split('\n').filter((l) => l.includes('test-pm')).slice(0, 2).join('\n'))
  process.exitCode = 1
} finally {
  await db.close()
}
