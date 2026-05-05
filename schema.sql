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

-- ---------------------------------------------------------------------------
-- Potential Face — AI-generated photorealistic image of the user's improved
-- face, generated via OpenAI gpt-image-1 from a baseline scan.  Drives the
-- "Stage N" staircase loop: a row exists per user per stage; status moves
-- pending -> ready -> unlocked once the user demonstrably progresses.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'potential_face_status') THEN
    CREATE TYPE public.potential_face_status AS ENUM (
      'pending',   -- generation job enqueued, image not yet produced
      'ready',     -- image generated and stored, awaiting unlock
      'failed',    -- generation failed after all retries
      'unlocked'   -- user met the unlock conditions; superseded by stage+1
    );
  END IF;
END$$;

CREATE TABLE IF NOT EXISTS public.potential_faces (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  baseline_scan_id      uuid        NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  stage                 integer     NOT NULL CHECK (stage >= 1),
  status                public.potential_face_status NOT NULL DEFAULT 'pending',

  -- Storage paths in the `potential-faces` bucket. Signed URLs are minted on read.
  primary_image_path    text        NULL,
  alternate_image_path  text        NULL,

  prompt_version        text        NOT NULL DEFAULT 'v1',
  -- Array of { group, sub_metric, baseline_score, target_score }
  targeted_metrics      jsonb       NOT NULL DEFAULT '[]'::jsonb,

  regenerated_count     integer     NOT NULL DEFAULT 0 CHECK (regenerated_count >= 0 AND regenerated_count <= 1),
  error_reason          text        NULL,

  generated_at          timestamptz NULL,
  unlocked_at           timestamptz NULL,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT potential_faces_user_stage_unique UNIQUE (user_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_potential_faces_user_status
  ON public.potential_faces (user_id, status);

CREATE INDEX IF NOT EXISTS idx_potential_faces_user_stage_desc
  ON public.potential_faces (user_id, stage DESC);

DROP TRIGGER IF EXISTS potential_faces_updated_at ON public.potential_faces;
CREATE TRIGGER potential_faces_updated_at
  BEFORE UPDATE ON public.potential_faces
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Audit log of every gpt-image-1 generation attempt for cost & latency tracking.
-- Kept separate from the canonical row so failed attempts don't pollute it.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.potential_face_generations (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             text        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  potential_face_id   uuid        NOT NULL REFERENCES public.potential_faces(id) ON DELETE CASCADE,
  prompt_version      text        NOT NULL,
  model               text        NOT NULL,
  candidate_count     integer     NOT NULL DEFAULT 1,
  latency_ms          integer     NOT NULL,
  cost_cents          integer     NULL,
  size                text        NULL,
  quality             text        NULL,
  requested_candidate_count integer NULL,
  source_image_bytes  integer     NULL,
  source_image_width  integer     NULL,
  source_image_height integer     NULL,
  provider_request_id text        NULL,
  provider_usage      jsonb       NULL,
  generation_phase    text        NULL,
  success             boolean     NOT NULL,
  error               text        NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_potential_face_generations_user_created
  ON public.potential_face_generations (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_potential_face_generations_face
  ON public.potential_face_generations (potential_face_id);

ALTER TABLE public.potential_face_generations
  ADD COLUMN IF NOT EXISTS size text NULL,
  ADD COLUMN IF NOT EXISTS quality text NULL,
  ADD COLUMN IF NOT EXISTS requested_candidate_count integer NULL,
  ADD COLUMN IF NOT EXISTS source_image_bytes integer NULL,
  ADD COLUMN IF NOT EXISTS source_image_width integer NULL,
  ADD COLUMN IF NOT EXISTS source_image_height integer NULL,
  ADD COLUMN IF NOT EXISTS provider_request_id text NULL,
  ADD COLUMN IF NOT EXISTS provider_usage jsonb NULL,
  ADD COLUMN IF NOT EXISTS generation_phase text NULL;
