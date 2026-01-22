-- ================================================================
-- Short-Term Conversation Cache (TTL-based)
-- ================================================================

CREATE TABLE IF NOT EXISTS public.conversation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  recent_messages JSONB NOT NULL DEFAULT '[]'::jsonb,
  summary JSONB,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT conversation_cache_unique_user_conversation UNIQUE (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conversation_cache_conversation_id
  ON public.conversation_cache(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_cache_user_id
  ON public.conversation_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_conversation_cache_expires_at
  ON public.conversation_cache(expires_at);

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================
ALTER TABLE public.conversation_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own conversation cache" ON public.conversation_cache;
CREATE POLICY "Users can view own conversation cache"
  ON public.conversation_cache FOR SELECT
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

DROP POLICY IF EXISTS "Users can insert own conversation cache" ON public.conversation_cache;
CREATE POLICY "Users can insert own conversation cache"
  ON public.conversation_cache FOR INSERT
  WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

DROP POLICY IF EXISTS "Users can update own conversation cache" ON public.conversation_cache;
CREATE POLICY "Users can update own conversation cache"
  ON public.conversation_cache FOR UPDATE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

DROP POLICY IF EXISTS "Users can delete own conversation cache" ON public.conversation_cache;
CREATE POLICY "Users can delete own conversation cache"
  ON public.conversation_cache FOR DELETE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_cache TO authenticated;
