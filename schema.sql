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
