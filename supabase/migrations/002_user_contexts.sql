-- ============================================================
-- GTD App — User Custom Contexts
-- Stores user-defined context tags so they persist across tasks
-- ============================================================

create table user_contexts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  name       text not null,
  created_at timestamptz not null default now(),

  unique (user_id, name)
);

create index idx_user_contexts_user_id on user_contexts(user_id);

-- ── Row Level Security ──────────────────────────────────────

alter table user_contexts enable row level security;

create policy "user_contexts: own rows only"
  on user_contexts for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- ── Seed existing custom contexts from tasks ────────────────
-- Copies any context values that aren't in the default set

insert into user_contexts (user_id, name)
select distinct t.user_id, unnest(t.contexts) as name
from tasks t
where array_length(t.contexts, 1) > 0
on conflict (user_id, name) do nothing;

-- Remove default contexts that were accidentally seeded
delete from user_contexts
where name in ('@home', '@office', '@phone', '@computer', '@errands', '@waiting');
