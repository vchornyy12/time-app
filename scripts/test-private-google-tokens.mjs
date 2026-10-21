// Tests permissions/lifecycle with a stub Vault API. Does not test Vault crypto.
// node scripts/test-private-google-tokens.mjs /path/to/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite')
const db = new PGlite()
const owner = '11111111-1111-4111-8111-111111111111'
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create schema vault;
    create table vault.secrets(id uuid primary key default gen_random_uuid(),secret text);
    create view vault.decrypted_secrets as select id,secret as decrypted_secret from vault.secrets;
    create function vault.create_secret(value text) returns uuid language plpgsql as $$ declare new_id uuid; begin
      insert into vault.secrets(secret) values(value) returning id into new_id; return new_id; end $$;
    create function vault.update_secret(secret_id uuid,value text) returns void language sql as $$ update vault.secrets set secret=value where id=secret_id $$;`)
  for (const f of ['001_initial_schema.sql','20260309000000_add_calendar_connected.sql']) await db.exec(await readFile(`supabase/migrations/${f}`,'utf8'))
  await db.exec(`insert into auth.users values('${owner}'); insert into user_integrations(user_id,google_refresh_token,calendar_connected) values('${owner}','legacy-synthetic-token',true); grant all on user_integrations to anon,authenticated;`)
  const sql = (await readFile('supabase/migrations/20261020000004_private_google_tokens.sql','utf8')).replace('CREATE EXTENSION IF NOT EXISTS supabase_vault WITH SCHEMA vault;','')
  await db.exec(sql);
  await db.exec(`set role authenticated; set request.jwt.claim.sub='${owner}';`)
  await assert.rejects(db.query('select google_token_secret_id from user_integrations'), /permission denied/)
  await assert.rejects(db.exec(`update user_integrations set google_token_secret_id=gen_random_uuid()`), /permission denied/)
  await db.exec('reset role')
  const lockdown = await readFile('supabase/migrations/20261020000005_lock_down_google_tokens.sql','utf8')
  await db.exec(lockdown); await db.exec(sql); await db.exec(lockdown)
  let row = (await db.query('select * from user_integrations')).rows[0]
  assert.equal(row.google_refresh_token,null); assert.ok(row.google_token_secret_id); assert.equal(row.google_connected,true)
  for (const role of ['anon','authenticated']) {
    await db.exec(`set role ${role}; set request.jwt.claim.sub='${owner}';`)
    await assert.rejects(db.query(`select public.get_google_integration_secret('${owner}')`), /permission denied/)
    await assert.rejects(db.query(`select google_refresh_token from user_integrations`), /permission denied/)
    await assert.rejects(db.query(`select public.set_google_integration_secret('${owner}','injected',true)`), /permission denied/)
    if (role === 'authenticated') assert.equal((await db.query('select google_connected from user_integrations')).rows[0].google_connected,true)
    await db.exec('reset role')
  }
  console.log('PASS migration moves legacy tokens, is repeatable, and denies client token access/RPC execution')
  await db.exec('set role service_role')
  row = (await db.query(`select public.get_google_integration_secret('${owner}') as value`)).rows[0].value
  assert.equal(row.google_refresh_token,'legacy-synthetic-token')
  await db.exec(`select public.set_google_integration_secret('${owner}','rotated-synthetic-token',true)`)
  assert.equal((await db.query(`select public.get_google_integration_secret('${owner}') as value`)).rows[0].value.google_refresh_token,'rotated-synthetic-token')
  await db.exec(`select public.clear_google_integration_secret('${owner}'); reset role;`)
  assert.equal((await db.query('select count(*)::int as n from vault.secrets')).rows[0].n,0)
  await db.exec(`set role service_role; select public.set_google_integration_secret('${owner}','final-synthetic-token',true); reset role; delete from auth.users where id='${owner}';`)
  assert.equal((await db.query('select count(*)::int as n from vault.secrets')).rows[0].n,0)
  console.log('PASS service-only read/rotation/disconnect and auth deletion remove managed secrets')
} finally { await db.close() }
