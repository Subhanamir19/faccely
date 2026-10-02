-- ============================================================================
-- Push notifications — database schema (step 1 of 1)
--
-- HOW TO RUN THIS
--   1. Open https://supabase.com/dashboard and pick the SigmaMax project.
--   2. Left sidebar -> SQL Editor -> New query.
--   3. Paste this whole file in, press Run.
--   4. You should see "Success. No rows returned." That is the correct result.
--
-- Safe to run more than once: every statement uses IF NOT EXISTS.
--
-- The backend talks to this table with the service-role key, which bypasses
-- row-level security. RLS is on with no policies so the app's public key
-- cannot read other users' tokens.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- push_tokens — one row per device install that granted notifications.
--
-- token    : the Expo push token (ExponentPushToken[...]). Unique, because a
--            device reinstall or account switch must move the token, not
--            duplicate it.
-- platform : "ios" | "android", for debugging delivery issues.
-- ----------------------------------------------------------------------------
create table if not exists public.push_tokens (
  token      text primary key,
  user_id    text not null references public.users (id) on delete cascade,
  platform   text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_idx
  on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;
