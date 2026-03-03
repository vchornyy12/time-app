-- ============================================================
-- GTD App — Initial Schema
-- Run this in the Supabase SQL Editor (once, in order)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- ENUMS
-- ────────────────────────────────────────────────────────────

create type task_status as enum (
  'inbox',
  'next_actions',
  'waiting_for',
  'calendar',
  'someday_maybe',
  'notes',
  'trash',
  'done'
);

create type project_status as enum (
  'active',
  'completed'
);

-- ────────────────────────────────────────────────────────────
-- PROJECTS (defined before tasks because tasks.project_id refs it)
-- ────────────────────────────────────────────────────────────

create table projects (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null references auth.users(id) on delete cascade,
  title               text not null,
  completion_criteria text not null default '',
  rough_plan          jsonb not null default '[]'::jsonb,
  first_step_task_id  uuid,                          -- filled after first task created
  status              project_status not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- TASKS
-- ────────────────────────────────────────────────────────────

create table tasks (
  id                          uuid primary key default gen_random_uuid(),
  user_id                     uuid not null references auth.users(id) on delete cascade,
  project_id                  uuid references projects(id) on delete set null,
  title                       text not null,
  status                      task_status not null default 'inbox',
  scheduled_at                timestamptz,
  due_date                    date,
  delegated_to                text,
  is_delegation_communicated  boolean not null default false,
  google_calendar_event_id    text,
  contexts                    text[] not null default '{}',
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now()
);

-- Now we can add the forward reference on projects
alter table projects
  add constraint fk_first_step_task
  foreign key (first_step_task_id)
  references tasks(id)
  on delete set null;

-- ────────────────────────────────────────────────────────────
-- USER INTEGRATIONS
-- ────────────────────────────────────────────────────────────

create table user_integrations (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null unique references auth.users(id) on delete cascade,
  google_refresh_token  text,
  google_calendar_id    text,
  created_at            timestamptz not null default now()
);

-- ────────────────────────────────────────────────────────────
-- UPDATED_AT TRIGGER
-- ────────────────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger tasks_updated_at
  before update on tasks
  for each row execute function set_updated_at();

create trigger projects_updated_at
  before update on projects
  for each row execute function set_updated_at();

-- ────────────────────────────────────────────────────────────
-- INDEXES
-- ────────────────────────────────────────────────────────────

create index idx_tasks_user_status   on tasks(user_id, status);
create index idx_tasks_project_id    on tasks(project_id);
create index idx_projects_user_id    on projects(user_id);

-- ────────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ────────────────────────────────────────────────────────────

alter table tasks             enable row level security;
alter table projects          enable row level security;
alter table user_integrations enable row level security;

-- tasks: users see and manage only their own rows
create policy "tasks: own rows only"
  on tasks for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- projects: users see and manage only their own rows
create policy "projects: own rows only"
  on projects for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());

-- user_integrations: users see and manage only their own row
create policy "integrations: own row only"
  on user_integrations for all
  using  (user_id = auth.uid())
  with check (user_id = auth.uid());
