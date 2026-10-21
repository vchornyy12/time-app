import {readFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const {PGlite} = await import(process.argv[2] ?? '@electric-sql/pglite')
const db = new PGlite()
const owner='11111111-1111-4111-8111-111111111111'
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    grant usage on schema public,auth to anon,authenticated,service_role;`)
  for (const f of ['001_initial_schema.sql','002_user_contexts.sql','004_rls_hardening.sql','006_daily_reflections.sql','008_clarity_protocol.sql','20261020000001_user_preferences.sql']) await db.exec(await readFile('supabase/migrations/'+f,'utf8'))
  await db.exec(`alter table tasks add column attachments jsonb not null default '[]'; grant all on all tables in schema public to anon,authenticated;`)
  const grants=await readFile('supabase/migrations/20261020000003_minimum_api_privileges.sql','utf8')
  const bounds=await readFile('supabase/migrations/20261020000006_data_api_bounds.sql','utf8')
  await db.exec(grants); await db.exec(bounds); await db.exec(grants); await db.exec(bounds)
  await db.exec(`insert into auth.users values('${owner}');set role authenticated;set request.jwt.claim.sub='${owner}';`)
  await db.exec(`insert into tasks(user_id,title) values('${owner}','valid')`)
  await assert.rejects(db.exec(`insert into tasks(user_id,title) values('${owner}',repeat('x',501))`), /check constraint/)
  await assert.rejects(db.exec(`insert into tasks(user_id,title,contexts) values('${owner}','bad',array_fill('tag'::text,array[21]))`), /check constraint/)
  const metadata=[{name:'private',path:'22222222-2222-4222-8222-222222222222/file',type:'text/plain',size:1}]
  await assert.rejects(db.query('insert into tasks(user_id,title,attachments) values($1,$2,$3)',[owner,'bad',JSON.stringify(metadata)]), /check constraint/)
  await assert.rejects(db.exec(`truncate tasks`), /permission denied/)
  await db.exec('reset role;set role anon;')
  await assert.rejects(db.exec('select id from tasks'), /permission denied/)
  console.log('PASS named grants remove anon/TRUNCATE, retain owner CRUD; direct writes enforce title/context/attachment bounds')
} finally {await db.close()}
