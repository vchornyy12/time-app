// Isolated PostgreSQL check; never connects to the production database.
// node scripts/test-data-api-grants.mjs /path/to/@electric-sql/pglite/dist/index.js
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite');
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
const db = new PGlite();
const tables = ['projects','tasks','user_integrations','user_contexts','daily_reflections','clarity_sessions','user_preferences'];
try {
await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
grant usage on schema public, auth to anon, authenticated, service_role;`);
for (const f of ['001_initial_schema.sql','002_user_contexts.sql','004_rls_hardening.sql','006_daily_reflections.sql','008_clarity_protocol.sql','20261020000001_user_preferences.sql']) {
 await db.exec(await readFile('supabase/migrations/'+f,'utf8'));
}
async function check() {
 for (const t of tables) {
  for (const role of ['authenticated','service_role']) for (const p of ['SELECT','INSERT','UPDATE','DELETE']) {
   const {rows} = await db.query(`select has_table_privilege($1,$2,$3) as ok`,[role,'public.'+t,p]);
   assert.equal(rows[0].ok,true,`${role} ${t} ${p}`);
  }
  const {rows} = await db.query(`select has_table_privilege('anon',$1,'SELECT') as ok`,['public.'+t]);
  assert.equal(rows[0].ok,false,`anon ${t}`);
 }
}
await check();
console.log('PASS fresh table migrations grant CRUD to authenticated/service_role without anonymous access');
for (const t of tables) await db.exec(`revoke all on public.${t} from authenticated, service_role`);
const fix=await readFile('supabase/migrations/20261020000000_explicit_data_api_grants.sql','utf8');
await db.exec(fix); await db.exec(fix);
const preferences = await readFile('supabase/migrations/20261020000001_user_preferences.sql','utf8');
await db.exec(preferences); await db.exec(preferences); await check();
console.log('PASS upgrade migration repairs missing grants and is repeatable');
await db.exec(`insert into auth.users values ('11111111-1111-4111-8111-111111111111'),('22222222-2222-4222-8222-222222222222');
insert into tasks(user_id,title) values ('11111111-1111-4111-8111-111111111111','own'),('22222222-2222-4222-8222-222222222222','other');
set role authenticated; set request.jwt.claim.sub='11111111-1111-4111-8111-111111111111';`);
assert.deepEqual((await db.query('select title from tasks')).rows,[{title:'own'}]);
await assert.rejects(db.exec(`insert into tasks(user_id,title) values ('22222222-2222-4222-8222-222222222222','forbidden')`),/row-level security/);
console.log('PASS authenticated access keeps cross-user RLS isolation');
await db.exec(`insert into user_preferences(user_id,last_weekly_review) values ('11111111-1111-4111-8111-111111111111',now()) on conflict(user_id) do update set last_weekly_review=excluded.last_weekly_review;`);
await assert.rejects(db.exec(`insert into user_preferences(user_id) values ('22222222-2222-4222-8222-222222222222')`),/row-level security/);
await db.exec(`reset role; grant all on user_preferences to anon, authenticated;`);
await db.exec(preferences);
assert.equal((await db.query('select count(*)::int as n from user_preferences')).rows[0].n,1);
for (const role of ['anon','authenticated']) {
 assert.equal((await db.query(`select has_table_privilege($1,'public.user_preferences','TRUNCATE') as ok`,[role])).rows[0].ok,false);
}
await check();
console.log('PASS preferences upsert, cross-user denial, existing data preservation and privilege hardening');
} finally { await db.close(); }
