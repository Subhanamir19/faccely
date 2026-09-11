-- ============================================================================
-- Coach — database schema (step 1 of 1)
--
-- HOW TO RUN THIS
--   1. Open https://supabase.com/dashboard and pick the SigmaMax project.
--   2. Left sidebar -> SQL Editor -> New query.
--   3. Paste this whole file in, press Run.
--   4. You should see "Success. No rows returned." That is the correct result.
--
-- Safe to run more than once: every statement uses IF NOT EXISTS, so a second
-- run changes nothing and cannot delete data.
--
-- The backend talks to these tables with the Supabase service-role key, which
-- bypasses row-level security. RLS is still switched on with no policies, so
-- that the app (and anyone holding the public key) cannot read them directly.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- coach_threads — one row per conversation.
-- Most users have exactly one long-running thread.
-- ----------------------------------------------------------------------------
create table if not exists public.coach_threads (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.users (id) on delete cascade,
  title        text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz,
  archived     boolean not null default false
);

create index if not exists coach_threads_user_updated_idx
  on public.coach_threads (user_id, updated_at desc);

-- ----------------------------------------------------------------------------
-- coach_messages — one row per message, user and assistant alike.
--
-- blocks  : the rendered answer as an array of typed blocks (text, chart,
--           metric_card, ...). Null for user messages.
-- tools   : which data lookups ran for this answer, kept for debugging.
-- usage   : token counts and model name, kept for cost reporting.
-- ----------------------------------------------------------------------------
create table if not exists public.coach_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.coach_threads (id) on delete cascade,
  user_id    uuid not null references public.users (id) on delete cascade,
  role       text not null check (role in ('user', 'assistant', 'system')),
  content    text,
  blocks     jsonb,
  tools      jsonb,
  usage      jsonb,
  screen     text,
  created_at timestamptz not null default now()
);

create index if not exists coach_messages_thread_created_idx
  on public.coach_messages (thread_id, created_at);

create index if not exists coach_messages_user_created_idx
  on public.coach_messages (user_id, created_at desc);

-- ----------------------------------------------------------------------------
-- coach_memory — durable facts about the user, learned from conversation.
-- Example: key 'braces', value 'in braces until 2027'.
-- Capped in application code at roughly 20 rows per user, oldest touched first.
-- ----------------------------------------------------------------------------
create table if not exists public.coach_memory (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users (id) on delete cascade,
  key           text not null,
  value         text not null,
  source        text not null default 'chat' check (source in ('chat', 'onboarding', 'scan')),
  confidence    real not null default 1.0,
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz not null default now(),
  unique (user_id, key)
);

create index if not exists coach_memory_user_used_idx
  on public.coach_memory (user_id, last_used_at desc);

-- ----------------------------------------------------------------------------
-- coach_usage — one row per user per billing week.
--
-- Quota is counted in tokens, not messages, so a user who writes long messages
-- gets fewer of them. The app shows the remaining count as "messages left".
--
-- period_start is the Monday 00:00 UTC of the week the row covers.
-- ----------------------------------------------------------------------------
create table if not exists public.coach_usage (
  user_id         uuid not null references public.users (id) on delete cascade,
  period_start    date not null,
  tokens_in       bigint not null default 0,
  tokens_out      bigint not null default 0,
  messages_count  integer not null default 0,
  images_count    integer not null default 0,
  cost_usd        numeric(10, 5) not null default 0,
  day_counts      jsonb not null default '{}'::jsonb,
  updated_at      timestamptz not null default now(),
  primary key (user_id, period_start)
);

-- ----------------------------------------------------------------------------
-- Lock the tables down. The backend uses the service-role key and is unaffected.
-- ----------------------------------------------------------------------------
alter table public.coach_threads  enable row level security;
alter table public.coach_messages enable row level security;
alter table public.coach_memory   enable row level security;
alter table public.coach_usage    enable row level security;

-- ----------------------------------------------------------------------------
-- Keep coach_threads.updated_at current whenever a message is written, so the
-- thread list can be sorted by recent activity without an extra write.
-- ----------------------------------------------------------------------------
create or replace function public.coach_touch_thread()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.coach_threads
     set updated_at = now()
   where id = new.thread_id;
  return new;
end;
$$;

drop trigger if exists coach_messages_touch_thread on public.coach_messages;
create trigger coach_messages_touch_thread
  after insert on public.coach_messages
  for each row
  execute function public.coach_touch_thread();
