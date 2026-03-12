-- ============================================================
-- GTD App — Mock / Seed Data
-- Run once in the Supabase SQL Editor while logged in as your
-- test account. Populates 50 tasks, 3 projects, custom contexts,
-- and 14 daily reflections spread across 3 months.
--
-- SAFE TO RE-RUN: wrapped in a transaction; deletes existing
-- seed rows (title LIKE 'SEED:%') before inserting fresh ones.
-- ============================================================

DO $$
DECLARE
  -- ── Resolve your user ──────────────────────────────────────
  v_uid   uuid := '37358c38-38c4-483d-882a-147fdef3e899';

  -- ── Project IDs ────────────────────────────────────────────
  p_gtd   uuid := gen_random_uuid();   -- GTD App v2 launch
  p_web   uuid := gen_random_uuid();   -- Personal website redesign
  p_ts    uuid := gen_random_uuid();   -- Learn TypeScript advanced patterns

BEGIN

RAISE NOTICE 'Seeding for user %', v_uid;

-- ── 0. Clean previous seed data ────────────────────────────
DELETE FROM daily_reflections WHERE user_id = v_uid AND content LIKE 'SEED:%';
DELETE FROM tasks    WHERE user_id = v_uid AND title LIKE 'SEED:%';
DELETE FROM projects WHERE user_id = v_uid AND title LIKE 'SEED:%';
DELETE FROM user_contexts WHERE user_id = v_uid AND name LIKE '@seed-%';

-- ── 1. Custom contexts ──────────────────────────────────────
INSERT INTO user_contexts (user_id, name) VALUES
  (v_uid, '@seed-deep-work'),
  (v_uid, '@seed-quick-win');

-- ── 2. Projects ─────────────────────────────────────────────
INSERT INTO projects (id, user_id, title, completion_criteria, rough_plan, status, created_at) VALUES
  (
    p_gtd, v_uid,
    'SEED: Launch GTD App v2',
    'App is live on production with all core GTD views working and no P0 bugs.',
    '[
      {"id":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11","text":"Write technical spec","order":1},
      {"id":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a12","text":"Implement inbox processing flow","order":2},
      {"id":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a13","text":"Add calendar integration","order":3},
      {"id":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a14","text":"Beta test with 5 users","order":4},
      {"id":"a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a15","text":"Deploy to production","order":5}
    ]'::jsonb,
    'active',
    NOW() - INTERVAL '45 days'
  ),
  (
    p_web, v_uid,
    'SEED: Personal Website Redesign',
    'New site is live with portfolio, blog, and contact form.',
    '[
      {"id":"b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b11","text":"Gather inspiration references","order":1},
      {"id":"b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b12","text":"Design in Figma","order":2},
      {"id":"b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b13","text":"Build with Next.js","order":3},
      {"id":"b1eebc99-9c0b-4ef8-bb6d-6bb9bd380b14","text":"Write 3 portfolio case studies","order":4}
    ]'::jsonb,
    'active',
    NOW() - INTERVAL '30 days'
  ),
  (
    p_ts, v_uid,
    'SEED: Learn TypeScript Advanced Patterns',
    'Can confidently use generics, conditional types, and mapped types in production code.',
    '[
      {"id":"c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c11","text":"Complete generics module","order":1},
      {"id":"c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c12","text":"Complete conditional types module","order":2},
      {"id":"c2eebc99-9c0b-4ef8-bb6d-6bb9bd380c13","text":"Build a typed utility library","order":3}
    ]'::jsonb,
    'completed',
    NOW() - INTERVAL '60 days'
  );

-- ── 3. Tasks — INBOX (7) ────────────────────────────────────
INSERT INTO tasks (user_id, title, status, created_at) VALUES
  (v_uid, 'SEED: Review Q1 OKR progress',           'inbox', NOW() - INTERVAL '1 day'),
  (v_uid, 'SEED: Respond to newsletter subscribers', 'inbox', NOW() - INTERVAL '2 days'),
  (v_uid, 'SEED: Look into Raycast productivity tips','inbox', NOW() - INTERVAL '2 days'),
  (v_uid, 'SEED: Book dentist appointment',          'inbox', NOW() - INTERVAL '3 days'),
  (v_uid, 'SEED: Research standing desk options',    'inbox', NOW() - INTERVAL '4 days'),
  (v_uid, 'SEED: Decide on conference to attend',    'inbox', NOW() - INTERVAL '5 days'),
  (v_uid, 'SEED: Process last week''s notes',        'inbox', NOW() - INTERVAL '6 days');

-- ── 4. Tasks — NEXT ACTIONS (12, with contexts) ─────────────
INSERT INTO tasks (user_id, title, status, contexts, project_id, created_at) VALUES
  (v_uid, 'SEED: Write weekly review checklist',     'next_actions', '{@computer}',            p_gtd, NOW() - INTERVAL '3 days'),
  (v_uid, 'SEED: Fix textarea autosave edge case',   'next_actions', '{@computer,@seed-deep-work}', p_gtd, NOW() - INTERVAL '4 days'),
  (v_uid, 'SEED: Add dark-mode screenshot to README','next_actions', '{@computer}',            p_gtd, NOW() - INTERVAL '5 days'),
  (v_uid, 'SEED: Draft homepage hero copy',          'next_actions', '{@computer,@seed-deep-work}', p_web, NOW() - INTERVAL '2 days'),
  (v_uid, 'SEED: Export Figma design tokens',        'next_actions', '{@computer}',            p_web, NOW() - INTERVAL '6 days'),
  (v_uid, 'SEED: Buy new HDMI cable',                'next_actions', '{@errands}',             NULL,  NOW() - INTERVAL '1 day'),
  (v_uid, 'SEED: Pick up dry cleaning',              'next_actions', '{@errands}',             NULL,  NOW() - INTERVAL '2 days'),
  (v_uid, 'SEED: Call landlord about lease renewal', 'next_actions', '{@phone}',               NULL,  NOW() - INTERVAL '3 days'),
  (v_uid, 'SEED: Schedule team retrospective',       'next_actions', '{@phone,@office}',       NULL,  NOW() - INTERVAL '4 days'),
  (v_uid, 'SEED: Clear out email inbox to zero',     'next_actions', '{@computer,@seed-quick-win}', NULL, NOW() - INTERVAL '1 day'),
  (v_uid, 'SEED: Organise home office cables',       'next_actions', '{@home}',                NULL,  NOW() - INTERVAL '7 days'),
  (v_uid, 'SEED: Update dependencies in gtdapp',     'next_actions', '{@computer}',            p_gtd, NOW() - INTERVAL '8 days');

-- ── 5. Tasks — WAITING FOR (6) ──────────────────────────────
INSERT INTO tasks (user_id, title, status, delegated_to, due_date, is_delegation_communicated, created_at) VALUES
  (v_uid, 'SEED: Code review from Sarah',           'waiting_for', 'Sarah',    (NOW() + INTERVAL '2 days')::date,  true,  NOW() - INTERVAL '3 days'),
  (v_uid, 'SEED: Design mockups from Alex',         'waiting_for', 'Alex',     (NOW() + INTERVAL '5 days')::date,  true,  NOW() - INTERVAL '5 days'),
  (v_uid, 'SEED: Invoice payment from client',      'waiting_for', 'Client',   (NOW() + INTERVAL '14 days')::date, true,  NOW() - INTERVAL '10 days'),
  (v_uid, 'SEED: Contract draft from legal team',   'waiting_for', 'Legal',    (NOW() + INTERVAL '7 days')::date,  false, NOW() - INTERVAL '2 days'),
  (v_uid, 'SEED: Server access credentials from IT','waiting_for', 'IT Dept',  NULL,                               false, NOW() - INTERVAL '4 days'),
  (v_uid, 'SEED: Feedback on proposal from manager','waiting_for', 'Manager',  (NOW() + INTERVAL '3 days')::date,  true,  NOW() - INTERVAL '6 days');

-- ── 6. Tasks — CALENDAR (4) ─────────────────────────────────
INSERT INTO tasks (user_id, title, status, scheduled_at, created_at) VALUES
  (v_uid, 'SEED: 1-on-1 with mentor',               'calendar', NOW() + INTERVAL '1 day',    NOW() - INTERVAL '2 days'),
  (v_uid, 'SEED: Team sprint planning',              'calendar', NOW() + INTERVAL '3 days',   NOW() - INTERVAL '1 day'),
  (v_uid, 'SEED: Doctor check-up',                  'calendar', NOW() + INTERVAL '10 days',  NOW() - INTERVAL '5 days'),
  (v_uid, 'SEED: Product demo to stakeholders',     'calendar', NOW() + INTERVAL '14 days',  NOW() - INTERVAL '3 days');

-- ── 7. Tasks — SOMEDAY / MAYBE (5) ──────────────────────────
INSERT INTO tasks (user_id, title, status, created_at) VALUES
  (v_uid, 'SEED: Learn Rust for systems programming', 'someday_maybe', NOW() - INTERVAL '20 days'),
  (v_uid, 'SEED: Build a mechanical keyboard',         'someday_maybe', NOW() - INTERVAL '15 days'),
  (v_uid, 'SEED: Take an improv comedy class',         'someday_maybe', NOW() - INTERVAL '30 days'),
  (v_uid, 'SEED: Read "Deep Work" by Cal Newport',     'someday_maybe', NOW() - INTERVAL '10 days'),
  (v_uid, 'SEED: Start a podcast on productivity',     'someday_maybe', NOW() - INTERVAL '45 days');

-- ── 8. Tasks — NOTES (3) ────────────────────────────────────
INSERT INTO tasks (user_id, title, status, created_at) VALUES
  (v_uid, 'SEED: GTD contexts best practices reference', 'notes', NOW() - INTERVAL '20 days'),
  (v_uid, 'SEED: Meeting notes — product strategy Jan',  'notes', NOW() - INTERVAL '40 days'),
  (v_uid, 'SEED: Book recommendations from team',        'notes', NOW() - INTERVAL '12 days');

-- ── 9. Tasks — TRASH (3) ────────────────────────────────────
INSERT INTO tasks (user_id, title, status, created_at) VALUES
  (v_uid, 'SEED: Old idea that no longer makes sense', 'trash', NOW() - INTERVAL '15 days'),
  (v_uid, 'SEED: Event that was cancelled',            'trash', NOW() - INTERVAL '20 days'),
  (v_uid, 'SEED: Duplicate capture item',              'trash', NOW() - INTERVAL '7 days');

-- ── 10. Tasks — DONE, spread across 3 months ────────────────
-- These power the logbook / success diary pagination test.

-- January 2026 (4 tasks)
INSERT INTO tasks (user_id, title, status, project_id, contexts, completed_at, created_at) VALUES
  (v_uid, 'SEED: Ship TypeScript generics module',    'done', p_ts,  '{@computer,@seed-deep-work}', '2026-01-08 10:22:00+00', '2026-01-01 09:00:00+00'),
  (v_uid, 'SEED: Write first blog post draft',        'done', p_web, '{@computer}',                 '2026-01-15 16:45:00+00', '2026-01-10 09:00:00+00'),
  (v_uid, 'SEED: Set up CI/CD pipeline',              'done', p_gtd, '{@computer}',                 '2026-01-22 14:30:00+00', '2026-01-18 09:00:00+00'),
  (v_uid, 'SEED: Complete conditional types module',  'done', p_ts,  '{@computer,@seed-deep-work}', '2026-01-29 11:00:00+00', '2026-01-25 09:00:00+00');

-- February 2026 (5 tasks)
INSERT INTO tasks (user_id, title, status, project_id, contexts, completed_at, created_at) VALUES
  (v_uid, 'SEED: Design home page in Figma',          'done', p_web, '{@computer}',                 '2026-02-03 15:20:00+00', '2026-02-01 09:00:00+00'),
  (v_uid, 'SEED: Implement inbox capture shortcut',   'done', p_gtd, '{@computer,@seed-deep-work}', '2026-02-10 17:00:00+00', '2026-02-05 09:00:00+00'),
  (v_uid, 'SEED: Build typed utility library',        'done', p_ts,  '{@computer}',                 '2026-02-14 12:45:00+00', '2026-02-10 09:00:00+00'),
  (v_uid, 'SEED: Write 2 portfolio case studies',     'done', p_web, '{@computer,@seed-deep-work}', '2026-02-21 09:30:00+00', '2026-02-15 09:00:00+00'),
  (v_uid, 'SEED: Add weekly review page',             'done', p_gtd, '{@computer}',                 '2026-02-28 18:10:00+00', '2026-02-22 09:00:00+00');

-- March 2026 — current month (3 tasks this week for logbook "Today" / "Yesterday" testing)
INSERT INTO tasks (user_id, title, status, project_id, contexts, completed_at, created_at) VALUES
  (v_uid, 'SEED: Implement Success Diary feature',    'done', p_gtd, '{@computer,@seed-deep-work}', NOW() - INTERVAL '2 days', NOW() - INTERVAL '5 days'),
  (v_uid, 'SEED: Write TDD tests for logbook',        'done', p_gtd, '{@computer}',                 NOW() - INTERVAL '1 day',  NOW() - INTERVAL '4 days'),
  (v_uid, 'SEED: Deploy to staging & smoke test',     'done', p_gtd, '{@computer}',                 NOW() - INTERVAL '3 hours',NOW() - INTERVAL '1 day');

-- ── 11. Daily reflections (logbook) ─────────────────────────
INSERT INTO daily_reflections (user_id, date, content) VALUES
  -- January
  (v_uid, '2026-01-08', 'SEED: Huge day — finally got generics clicking. The trick was thinking in terms of constraints, not just placeholders.'),
  (v_uid, '2026-01-15', 'SEED: First blog draft done. Rougher than I wanted but it exists. Ship > perfect.'),
  (v_uid, '2026-01-22', 'SEED: CI pipeline green on first real PR. Worth the 3 hours of yak shaving.'),
  (v_uid, '2026-01-29', 'SEED: Finished the TS course module. Conditional types are genuinely magic.'),
  -- February
  (v_uid, '2026-02-03', 'SEED: Figma flow state for 4 hours straight. Home page looks exactly how I pictured it.'),
  (v_uid, '2026-02-10', 'SEED: Shipped the capture shortcut. First real UX improvement based on my own frustration.'),
  (v_uid, '2026-02-14', 'SEED: Done with the TS project. Feels like a real piece of work I''m proud of.'),
  (v_uid, '2026-02-21', 'SEED: Two case studies written. The process of articulating my decisions was more valuable than the docs themselves.'),
  (v_uid, '2026-02-28', 'SEED: Weekly review page live. End of a really solid month.'),
  -- March (recent days — upsert so existing real reflections are overwritten)
  (v_uid, (NOW() - INTERVAL '3 days')::date, 'SEED: Spec approved on first pass — documentation-first really works.'),
  (v_uid, (NOW() - INTERVAL '2 days')::date, 'SEED: Success Diary feature done. TDD made the refactor painless.'),
  (v_uid, (NOW() - INTERVAL '1 day')::date, 'SEED: All 297 tests green. The logbook "Load more" pagination works perfectly.')
ON CONFLICT (user_id, date) DO UPDATE SET content = EXCLUDED.content;

RAISE NOTICE 'Seed complete. 50 tasks, 3 projects, 12 reflections inserted.';

END $$;
