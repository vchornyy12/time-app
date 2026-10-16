// Run against an isolated in-memory PostgreSQL engine, never the production DB:
// node scripts/test-project-transactions.mjs /path/to/@electric-sql/pglite/dist/index.js
import { readFile } from 'node:fs/promises'
import assert from 'node:assert/strict'
const { PGlite } = await import(process.argv[2] ?? '@electric-sql/pglite')
const db = new PGlite()
let passed = 0
const migration = 'supabase/migrations/20261015000000_atomic_projects.sql'
const owner = '11111111-1111-4111-8111-111111111111'
const other = '22222222-2222-4222-8222-222222222222'
const origin = '33333333-3333-4333-8333-333333333333'
const failOrigin = '44444444-4444-4444-8444-444444444444'
const uuid = (n) => `55555555-5555-4555-8555-${String(n).padStart(12, '0')}`
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const check = async (name, test) => { await test(); passed++; console.log(`PASS ${name}`) }
const call = async (sql, params = []) => (await one(`select ${sql} as value`, params)).value
try {
  await db.exec(`
    create role anon; create role authenticated;
    create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as
      $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    grant usage on schema public, auth to authenticated, anon;
    grant execute on function auth.uid() to authenticated, anon;
  `)
  for (const file of [
    '001_initial_schema.sql', '002_user_contexts.sql', '004_rls_hardening.sql', '005_completed_at.sql',
    '20260527000000_add_recurrence_rule.sql', '20260703000000_recurrence_trigger.sql',
  ]) await db.exec(await readFile(`supabase/migrations/${file}`, 'utf8'))
  await db.exec(await readFile(migration, 'utf8'))
  // Re-applying does not alter user data or create duplicate functions.
  await db.exec(await readFile(migration, 'utf8'))
  await db.exec(`grant select, insert, update, delete on all tables in schema public to authenticated;
    insert into auth.users values('${owner}'), ('${other}');
    insert into public.tasks(id,user_id,title) values('${origin}','${owner}','Outcome'),('${failOrigin}','${owner}','Rollback');
    set role authenticated;
    set request.jwt.claim.sub = '${owner}';`)

  let projectId
  await check('conversion and retry return one project with the linked task', async () => {
    const input = [origin, 'Project', '', ['Step A', 'Step B'], 'First action']
    const result = await call('public.create_project_from_inbox($1,$2,$3,$4,$5)', input)
    projectId = result.project.id
    assert.equal(result.firstTask.project_id, projectId)
    assert.equal(result.project.first_step_task_id, origin)
    assert.equal(result.project.completion_criteria, '')
    assert.equal(result.project.rough_plan.length, 2)
    const retry = await call('public.create_project_from_inbox($1,$2,$3,$4,$5)', input)
    assert.equal(retry.project.id, projectId)
    assert.equal((await one('select count(*)::int as count from public.projects')).count, 1)
  })

  await check('a failing link write rolls the project and task conversion back', async () => {
    await db.exec(`reset role;
      create function public.fail_link() returns trigger language plpgsql as $$ begin
        if new.first_step_task_id = '${failOrigin}'::uuid then raise exception 'injected failure'; end if; return new;
      end $$;
      create trigger injected_link_failure before update on public.projects for each row execute function public.fail_link();
      set role authenticated;`)
    await assert.rejects(call('public.create_project_from_inbox($1,$2,$3,$4,$5)', [failOrigin, 'Broken', '', [], 'Step']), /injected failure/)
    assert.equal((await one('select count(*)::int as count from public.projects')).count, 1)
    assert.equal((await one('select status from public.tasks where id=$1', [failOrigin])).status, 'inbox')
    await db.exec('reset role; drop trigger injected_link_failure on public.projects; set role authenticated;')
  })

  let nextItem
  await check('promotion waits for a real active step; completion validates the relationship', async () => {
    const project = await one('select rough_plan from public.projects where id=$1', [projectId])
    nextItem = project.rough_plan[0].id
    await assert.rejects(call('public.promote_project_step($1,$2)', [projectId, nextItem]), /active step/)
    await assert.rejects(call('public.complete_project_step($1,$2)', [projectId, failOrigin]), /Project step not found/)
    await call('public.complete_project_step($1,$2)', [projectId, origin])
    assert.equal((await one('select status from public.tasks where id=$1', [origin])).status, 'done')
  })

  await check('failed promotion leaves the task absent and the entire plan intact', async () => {
    await db.exec(`reset role;
      create function public.fail_plan_update() returns trigger language plpgsql as $$ begin raise exception 'injected plan failure'; end $$;
      create trigger injected_plan_failure before update on public.projects for each row execute function public.fail_plan_update();
      set role authenticated;`)
    await assert.rejects(call('public.promote_project_step($1,$2)', [projectId, nextItem]), /injected plan failure/)
    assert.equal((await one('select count(*)::int as count from public.tasks where id=$1', [nextItem])).count, 0)
    assert.equal((await one('select jsonb_array_length(rough_plan) as count from public.projects where id=$1', [projectId])).count, 2)
    await db.exec('reset role; drop trigger injected_plan_failure on public.projects; set role authenticated;')
  })

  await check('promotion retry never creates another task or removes another item', async () => {
    const first = await call('public.promote_project_step($1,$2)', [projectId, nextItem])
    const retry = await call('public.promote_project_step($1,$2)', [projectId, nextItem])
    assert.equal(first.id, nextItem)
    assert.equal(retry.id, first.id)
    assert.equal((await one('select jsonb_array_length(rough_plan) as count from public.projects where id=$1', [projectId])).count, 1)
  })

  await check('add and stale reorder preserve the latest steps without duplicates', async () => {
    const added = await call('public.add_project_plan_step($1,$2,$3)', [projectId, uuid(1), 'New step'])
    await call('public.add_project_plan_step($1,$2,$3)', [projectId, uuid(1), 'New step'])
    const staleOrder = [nextItem] // This item was already promoted; the new items must survive.
    const plan = await call('public.reorder_project_plan($1,$2)', [projectId, staleOrder])
    assert.equal(plan.length, 2)
    assert.equal(plan[1].id, added.id)
    assert.deepEqual(plan.map((item) => item.order), [0, 1])
    await assert.rejects(call('public.reorder_project_plan($1,$2)', [projectId, [uuid(1), uuid(1)]]), /Invalid step order/)
  })

  await check('completing an already done step does not clear its successor', async () => {
    await call('public.complete_project_step($1,$2)', [projectId, origin])
    assert.equal((await one('select first_step_task_id from public.projects where id=$1', [projectId])).first_step_task_id, nextItem)
  })

  await check('failure while clearing the project pointer rolls task completion back', async () => {
    await db.exec(`reset role;
      create trigger injected_completion_failure before update on public.projects for each row execute function public.fail_plan_update();
      set role authenticated;`)
    await assert.rejects(call('public.complete_project_step($1,$2)', [projectId, nextItem]), /injected plan failure/)
    assert.equal((await one('select status from public.tasks where id=$1', [nextItem])).status, 'next_actions')
    await db.exec('reset role; drop trigger injected_completion_failure on public.projects; set role authenticated;')
  })

  await check('a stale trashed pointer does not prevent a new step, and completed projects reject new steps', async () => {
    const input = [failOrigin, 'Second project', '', [], 'Temporary step']
    const result = await call('public.create_project_from_inbox($1,$2,$3,$4,$5)', input)
    const secondId = result.project.id
    await db.query("update public.tasks set status='trash' where id=$1", [failOrigin])
    await call('public.add_project_plan_step($1,$2,$3)', [secondId, uuid(8), 'Actual step'])
    await call('public.promote_project_step($1,$2)', [secondId, uuid(8)])
    await assert.rejects(call('public.add_project_plan_step($1,$2,$3)', [secondId, uuid(8), 'Actual step']), /already been promoted/)
    await call('public.complete_project_step($1,$2)', [secondId, uuid(8)])
    await call('public.complete_project($1)', [secondId])
    await call('public.complete_project($1)', [secondId])
    await assert.rejects(call('public.add_project_plan_step($1,$2,$3)', [secondId, uuid(9), 'Extra']), /completed/)
  })

  await check('recurrence still runs inside the atomic completion function', async () => {
    await db.query("update public.tasks set recurrence_rule='weekly' where id=$1", [nextItem])
    await call('public.complete_project_step($1,$2)', [projectId, nextItem])
    const recurring = await one("select id from public.tasks where project_id=$1 and status='next_actions'", [projectId])
    assert.ok(recurring.id)
    await assert.rejects(call('public.complete_project($1)', [projectId]), /unfinished steps/)
    await assert.rejects(call('public.promote_project_step($1,$2)', [projectId, uuid(1)]), /active step/)
  })

  await check('all RPCs deny other users and leave the owner data untouched', async () => {
    await db.exec(`set request.jwt.claim.sub = '${other}'`)
    for (const [sql, params] of [
      ['public.create_project_from_inbox($1,$2,$3,$4,$5)', [origin, 'Stolen', '', [], 'Step']],
      ['public.promote_project_step($1,$2)', [projectId, uuid(1)]],
      ['public.add_project_plan_step($1,$2,$3)', [projectId, uuid(2), 'Stolen']],
      ['public.reorder_project_plan($1,$2)', [projectId, []]],
      ['public.complete_project_step($1,$2)', [projectId, nextItem]],
      ['public.complete_project($1)', [projectId]],
    ]) await assert.rejects(call(sql, params), /not found/)
    assert.equal((await one('select count(*)::int as count from public.projects')).count, 0)
    await db.exec(`set request.jwt.claim.sub = '${owner}'`)
  })

  await check('anonymous and unauthenticated callers cannot execute mutations', async () => {
    await db.exec("set request.jwt.claim.sub = ''")
    await assert.rejects(call('public.complete_project($1)', [projectId]), /Unauthorized/)
    await db.exec('set role anon')
    await assert.rejects(call('public.complete_project($1)', [projectId]), /permission denied/)
    await db.exec('reset role')
    const functions = (await db.query(`select p.proname, p.prosecdef,
      has_function_privilege('anon', p.oid, 'execute') as anon_execute,
      has_function_privilege('authenticated', p.oid, 'execute') as authed_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      where n.nspname='public' and p.proname in ('create_project_from_inbox', 'promote_project_step',
        'add_project_plan_step', 'reorder_project_plan', 'complete_project_step', 'complete_project')`)).rows
    assert.equal(functions.length, 6)
    for (const fn of functions) {
      assert.equal(fn.prosecdef, false)
      assert.equal(fn.anon_execute, false)
      assert.equal(fn.authed_execute, true)
    }
  })

  console.log(`${passed} PostgreSQL integration scenarios passed. No external database used.`)
} catch (error) { console.error(error.message); process.exitCode = 1 }
finally { await db.close() }
