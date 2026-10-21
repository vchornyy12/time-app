// Isolated model of production privilege drift, with synthetic users only.
// Run from repo root: node docs/security/2026-10-20/verify-analytics-mitigation.mjs /path/to/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite')
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
for (const type of ['json', 'jsonb']) {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$
        select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      grant usage on schema public,auth to anon,authenticated,service_role;`)
    for (const file of ['001_initial_schema.sql','002_user_contexts.sql','004_rls_hardening.sql']) {
      await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
    }
    await db.exec(`insert into auth.users values('${owner}'),('${other}');
      insert into tasks(user_id,title) values('${owner}','synthetic A'),('${other}','synthetic B');
      create function public.get_analytics(p_user_id uuid,p_from timestamptz)
      returns ${type} language sql security definer as $$
        select json${type === 'jsonb' ? 'b' : ''}_build_object('tasks_captured',count(*))
        from tasks where user_id=p_user_id and created_at>=p_from $$;
      set role anon;`)
    let result = await db.query(`select public.get_analytics('${other}','2020-01-01') as value`)
    assert.equal(result.rows[0].value.tasks_captured,1)
    await db.exec('reset role')
    const patch = await readFile('docs/security/2026-10-20/mitigate-analytics.sql','utf8')
    await db.exec(patch)
    await db.exec(patch)
    await db.exec('set role anon')
    await assert.rejects(db.query(`select public.get_analytics('${other}','2020-01-01')`), /permission denied/)
    await db.exec(`reset role; set role authenticated; set request.jwt.claim.sub='${owner}';`)
    result = await db.query(`select public.get_analytics('${other}','2020-01-01') as value`)
    assert.equal(result.rows[0].value.tasks_captured,0)
    result = await db.query(`select public.get_analytics('${owner}','2020-01-01') as value`)
    assert.equal(result.rows[0].value.tasks_captured,1)
    console.log(`PASS ${type}: modeled bypass reproduced; patch denies anon, isolates users, preserves own analytics and is repeatable`)
  } finally { await db.close() }
}
