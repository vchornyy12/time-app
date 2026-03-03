-- ============================================================
-- GTD App — Test Seed (optional, for manual RLS verification)
-- Run AFTER the migration. Uses Supabase Auth test users.
-- ============================================================

-- To test RLS isolation:
-- 1. Create two users via the Supabase Auth dashboard (or use the signup form)
-- 2. Replace the UUIDs below with the actual user IDs from auth.users
-- 3. Run this in the SQL Editor
-- 4. Then log in as each user and confirm they only see their own tasks

-- Example (replace UUIDs with real ones from your auth.users table):
--
-- insert into tasks (user_id, title, status) values
--   ('00000000-0000-0000-0000-000000000001', 'User A task 1', 'inbox'),
--   ('00000000-0000-0000-0000-000000000001', 'User A task 2', 'inbox'),
--   ('00000000-0000-0000-0000-000000000002', 'User B task 1', 'inbox');
--
-- Then verify: select * from tasks; — should return ALL rows as service role
-- From the app (anon key), each user should only see their own tasks.
