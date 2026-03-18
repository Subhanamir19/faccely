-- Sigma Max initial schema
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.users (
  id text PRIMARY KEY, -- Clerk user id
  email text,
  age integer,
  gender text,
  ethnicity text,
  onboarding_completed boolean NOT NULL DEFAULT false,
  device_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  model_version text NOT NULL,
  front_image_path text NOT NULL,
  side_image_path text,
  scores jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS public.analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  explanations jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scans_user_id_created_at
  ON public.scans (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_analyses_scan_id
  ON public.analyses (scan_id);

-- ---------------------------------------------------------------------------
-- Programs (70-day plans generated from scores)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.programs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  version text NOT NULL,
  scores_snapshot jsonb NOT NULL,
  days jsonb NOT NULL,
  metadata jsonb
);

CREATE INDEX IF NOT EXISTS idx_programs_user_id_created_at
  ON public.programs (user_id, created_at DESC);

-- ---------------------------------------------------------------------------
-- Program completions (per exercise/day)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.program_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  user_id text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day_number integer NOT NULL,
  exercise_id text NOT NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_program_completions_unique
  ON public.program_completions (program_id, day_number, exercise_id);

CREATE INDEX IF NOT EXISTS idx_program_completions_user
  ON public.program_completions (user_id, program_id);

-- ---------------------------------------------------------------------------
-- Insights (AI-generated progress comparisons)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.insights (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         text NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  latest_scan_id  uuid NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  created_at      timestamptz NOT NULL DEFAULT now(),
  content         jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_insights_user_scan_unique
  ON public.insights (user_id, latest_scan_id);

CREATE INDEX IF NOT EXISTS idx_insights_user_id
  ON public.insights (user_id);

-- ---------------------------------------------------------------------------
-- User task history (daily adaptive task completion records)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_task_history (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  date                 date        NOT NULL,                          -- local date: YYYY-MM-DD
  tasks_completed      jsonb       NOT NULL DEFAULT '[]'::jsonb,     -- array of exerciseId strings
  protocols_completed  jsonb       NOT NULL DEFAULT '[]'::jsonb,     -- array of protocol id strings
  mood                 integer     NULL CHECK (mood IN (1, 2, 3)),   -- 1=great 2=good 3=exhausted
  all_complete         boolean     NOT NULL DEFAULT false,
  completed_once       boolean     NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT user_task_history_user_date_unique UNIQUE (user_id, date)
);

CREATE INDEX IF NOT EXISTS idx_user_task_history_user_date
  ON public.user_task_history (user_id, date DESC);

-- ---------------------------------------------------------------------------
-- User streaks (current + longest streak per user)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.user_streaks (
  user_id              text        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  current_streak       integer     NOT NULL DEFAULT 0,
  longest_streak       integer     NOT NULL DEFAULT 0,
  last_completed_date  date        NULL,    -- local date of last all_complete=true day
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- updated_at trigger (shared by task history and streaks)
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER user_task_history_updated_at
  BEFORE UPDATE ON public.user_task_history
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER user_streaks_updated_at
  BEFORE UPDATE ON public.user_streaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
