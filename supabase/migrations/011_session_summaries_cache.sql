-- ================================================================
-- Session Summaries + Short-Term Cache (Sessions/Messages tables)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.session_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT session_summaries_unique_session UNIQUE (session_id)
);

CREATE TABLE IF NOT EXISTS public.session_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  recent_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT session_cache_unique_session UNIQUE (session_id)
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_session_id
  ON public.session_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_updated_at
  ON public.session_summaries(updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_session_cache_session_id
  ON public.session_cache(session_id);
CREATE INDEX IF NOT EXISTS idx_session_cache_expires_at
  ON public.session_cache(expires_at);

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================
ALTER TABLE public.session_summaries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_cache ENABLE ROW LEVEL SECURITY;

-- Session summaries policies (scoped via session ownership)
DROP POLICY IF EXISTS "Users can view own session summaries" ON public.session_summaries;
CREATE POLICY "Users can view own session summaries"
  ON public.session_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = public.session_summaries.session_id
        AND s.user_id::text = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can insert session summaries" ON public.session_summaries;
CREATE POLICY "Users can insert session summaries"
  ON public.session_summaries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = public.session_summaries.session_id
        AND s.user_id::text = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can update session summaries" ON public.session_summaries;
CREATE POLICY "Users can update session summaries"
  ON public.session_summaries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = public.session_summaries.session_id
        AND s.user_id::text = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can delete session summaries" ON public.session_summaries;
CREATE POLICY "Users can delete session summaries"
  ON public.session_summaries FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = public.session_summaries.session_id
        AND s.user_id::text = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

-- Session cache policies (scoped via session ownership)
DROP POLICY IF EXISTS "Users can view own session cache" ON public.session_cache;
CREATE POLICY "Users can view own session cache"
  ON public.session_cache FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = public.session_cache.session_id
        AND s.user_id::text = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can insert session cache" ON public.session_cache;
CREATE POLICY "Users can insert session cache"
  ON public.session_cache FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = public.session_cache.session_id
        AND s.user_id::text = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can update session cache" ON public.session_cache;
CREATE POLICY "Users can update session cache"
  ON public.session_cache FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = public.session_cache.session_id
        AND s.user_id::text = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can delete session cache" ON public.session_cache;
CREATE POLICY "Users can delete session cache"
  ON public.session_cache FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.sessions s
      WHERE s.id = public.session_cache.session_id
        AND s.user_id::text = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_summaries TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_cache TO authenticated;
