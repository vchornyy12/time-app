// Applies the agent-capture migration to an in-memory Postgres (PGlite) with
// stubbed Supabase auth, then checks the RLS limits for OAuth agent tokens.
// Usage: node scripts/test-agent-capture-migration.mjs /path/to/@electric-sql/pglite/dist/index.js
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
    CREATE TYPE task_status AS ENUM ('inbox','next_actions','waiting_for','calendar','someday_maybe','notes','trash','done');
    CREATE TABLE tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id),
      title text NOT NULL, status task_status NOT NULL DEFAULT 'inbox');
    CREATE TABLE projects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, title text NOT NULL);
    CREATE TABLE user_preferences (user_id uuid PRIMARY KEY, theme text);
    ALTER TABLE tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE projects ENABLE ROW LEVEL SECURITY; ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
    CREATE POLICY tasks_all ON tasks FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY projects_all ON projects FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    CREATE POLICY prefs_all ON user_preferences FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
    GRANT SELECT, INSERT, UPDATE, DELETE ON tasks, projects, user_preferences TO authenticated;
    CREATE SCHEMA storage; GRANT USAGE ON SCHEMA storage TO authenticated;
    CREATE TABLE storage.objects (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), bucket_id text, name text, owner_id uuid DEFAULT auth.uid());
    ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_objects ON storage.objects FOR ALL TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
    GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
  `)
  const migration = await readFile('supabase/migrations/20261119000000_agent_capture.sql', 'utf8')
  await db.exec(migration)
  await db.exec(migration) // idempotent re-run

  // Ordinary app session: unchanged behaviour.
  await app(async () => {
    await db.exec(`INSERT INTO tasks(user_id,title,status) VALUES ('${alice}','manual','next_actions')`)
    await db.exec(`UPDATE tasks SET title='manual 2' WHERE title='manual'`)
    await db.exec(`INSERT INTO projects(user_id,title) VALUES ('${alice}','p')`)
    await db.exec(`INSERT INTO user_preferences(user_id,theme) VALUES ('${alice}','dark')`)
    await db.exec(`INSERT INTO storage.objects(bucket_id,name) VALUES ('attachments','${alice}/a.pdf')`)
  })

  // Agent token: inbox capture only.
  await agent(async () => {
    await db.exec(`INSERT INTO tasks(user_id,title,status,source,source_ref,dedupe_key,captured_by)
      VALUES ('${alice}','from mail','inbox','gmail','m1','gmail:k1','claude-client')`)
    await assert.rejects(db.exec(`INSERT INTO tasks(user_id,title,status) VALUES ('${alice}','sneaky','next_actions')`), /row-level security/)
    const upd = await db.query(`UPDATE tasks SET status='trash' RETURNING id`)
    assert.equal(upd.rows.length, 0, 'agent token must not update tasks')
    const del = await db.query(`DELETE FROM tasks RETURNING id`)
    assert.equal(del.rows.length, 0, 'agent token must not delete tasks')
    assert.equal((await db.query('SELECT id FROM tasks')).rows.length, 2, 'agent token can read own tasks')
    await assert.rejects(db.exec(`INSERT INTO projects(user_id,title) VALUES ('${alice}','x')`), /row-level security/)
    assert.equal((await db.query(`UPDATE projects SET title='x' RETURNING id`)).rows.length, 0)
    assert.equal((await db.query(`DELETE FROM user_preferences RETURNING user_id`)).rows.length, 0)
    assert.equal((await db.query('SELECT id FROM storage.objects')).rows.length, 1, 'agent token can read own objects')
    await assert.rejects(db.exec(`INSERT INTO storage.objects(bucket_id,name) VALUES ('attachments','${alice}/b.pdf')`), /row-level security/)
    assert.equal((await db.query('DELETE FROM storage.objects RETURNING id')).rows.length, 0)
    // Cursors and audit are writable by the agent for its own user only.
    await db.exec(`INSERT INTO agent_cursors(user_id,source,cursor) VALUES ('${alice}','gmail','2026-11-19T10:00:00Z')`)
    await db.exec(`UPDATE agent_cursors SET cursor='2026-11-19T11:00:00Z' WHERE source='gmail'`)
    await db.exec(`INSERT INTO agent_events(user_id,client_id,tool,ok) VALUES ('${alice}','claude-client','capture_inbox_item',true)`)
    await assert.rejects(db.exec(`INSERT INTO agent_events(user_id,tool,ok) VALUES ('${bob}','x',true)`), /row-level security/)
    await assert.rejects(db.exec(`UPDATE agent_events SET ok=false`), /permission denied/)
    await assert.rejects(db.exec(`DELETE FROM agent_events`), /permission denied/)
  })

  // Dedupe key is unique per user; constraints reject bad values.
  await app(async () => {
    await assert.rejects(db.exec(`INSERT INTO tasks(user_id,title,dedupe_key) VALUES ('${alice}','dup','gmail:k1')`), /tasks_user_dedupe_key_unique/)
    await db.exec(`INSERT INTO tasks(user_id,title) VALUES ('${alice}','no key 1'), ('${alice}','no key 2')`)
    await assert.rejects(db.exec(`INSERT INTO tasks(user_id,title,source_url) VALUES ('${alice}','x','javascript:alert(1)')`), /tasks_source_url_bounds/)
    await assert.rejects(db.exec(`INSERT INTO tasks(user_id,title,source) VALUES ('${alice}','x','fax')`), /tasks_source_values/)
    // The human can still process an agent-captured task.
    assert.equal((await db.query(`UPDATE tasks SET status='next_actions' WHERE source='gmail' RETURNING id`)).rows.length, 1)
  })

  // Another user sees nothing of Alice's.
  await as(bob, { client_id: 'claude-client' }, async () => {
    assert.equal((await db.query('SELECT id FROM tasks')).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM agent_cursors')).rows.length, 0)
    assert.equal((await db.query('SELECT * FROM agent_events')).rows.length, 0)
  })
  console.log('agent capture migration: all checks passed')
} finally {
  await db.close()
}
