-- ============================================================================
-- Add/ensure medical_analyses table and CNN analysis fields
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.medical_analyses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL,
  image_name TEXT,
  image_url TEXT,
  image_storage_path TEXT,
  image_size BIGINT,
  status TEXT NOT NULL DEFAULT 'pending',
  model_version TEXT,
  diagnosis TEXT,
  confidence REAL,
  risk_level TEXT,
  detected_features TEXT[],
  recommendations TEXT[],
  classification_metrics JSONB,
  heatmap_path TEXT,
  processing_time INTEGER,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ensure required columns exist for existing tables
ALTER TABLE public.medical_analyses
  ADD COLUMN IF NOT EXISTS image_name TEXT,
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS image_storage_path TEXT,
  ADD COLUMN IF NOT EXISTS image_size BIGINT,
  ADD COLUMN IF NOT EXISTS status TEXT,
  ADD COLUMN IF NOT EXISTS model_version TEXT,
  ADD COLUMN IF NOT EXISTS diagnosis TEXT,
  ADD COLUMN IF NOT EXISTS confidence REAL,
  ADD COLUMN IF NOT EXISTS risk_level TEXT,
  ADD COLUMN IF NOT EXISTS detected_features TEXT[],
  ADD COLUMN IF NOT EXISTS recommendations TEXT[],
  ADD COLUMN IF NOT EXISTS classification_metrics JSONB,
  ADD COLUMN IF NOT EXISTS heatmap_path TEXT,
  ADD COLUMN IF NOT EXISTS processing_time INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_medical_analyses_user_id
  ON public.medical_analyses(user_id);

CREATE INDEX IF NOT EXISTS idx_medical_analyses_created_at
  ON public.medical_analyses(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_medical_analyses_status
  ON public.medical_analyses(status);
