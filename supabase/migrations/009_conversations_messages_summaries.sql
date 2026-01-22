-- ================================================================
-- Conversations + Messages + Summaries (Persistent Chat History)
-- ================================================================

-- Conversations (session metadata)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  message_count INTEGER NOT NULL DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Conversation messages (all user/assistant turns)
CREATE TABLE IF NOT EXISTS public.conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- Conversation summaries (compressed history)
CREATE TABLE IF NOT EXISTS public.conversation_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  message_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  CONSTRAINT conversation_summaries_unique_conversation UNIQUE (conversation_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_user_id
  ON public.conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at
  ON public.conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversations_last_message_at
  ON public.conversations(last_message_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_messages_conversation_id
  ON public.conversation_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_conversation_messages_created_at
  ON public.conversation_messages(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_summaries_conversation_id
  ON public.conversation_summaries(conversation_id);

-- ================================================================
-- Row Level Security (RLS)
-- ================================================================
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_summaries ENABLE ROW LEVEL SECURITY;

-- Conversations policies
DROP POLICY IF EXISTS "Users can view own conversations" ON public.conversations;
CREATE POLICY "Users can view own conversations"
  ON public.conversations FOR SELECT
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

DROP POLICY IF EXISTS "Users can insert own conversations" ON public.conversations;
CREATE POLICY "Users can insert own conversations"
  ON public.conversations FOR INSERT
  WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

DROP POLICY IF EXISTS "Users can update own conversations" ON public.conversations;
CREATE POLICY "Users can update own conversations"
  ON public.conversations FOR UPDATE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

DROP POLICY IF EXISTS "Users can delete own conversations" ON public.conversations;
CREATE POLICY "Users can delete own conversations"
  ON public.conversations FOR DELETE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

-- Messages policies (scoped via conversation ownership)
DROP POLICY IF EXISTS "Users can view own messages" ON public.conversation_messages;
CREATE POLICY "Users can view own messages"
  ON public.conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.conversation_messages.conversation_id
        AND c.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can insert messages into own conversations" ON public.conversation_messages;
CREATE POLICY "Users can insert messages into own conversations"
  ON public.conversation_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.conversation_messages.conversation_id
        AND c.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can update own messages" ON public.conversation_messages;
CREATE POLICY "Users can update own messages"
  ON public.conversation_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.conversation_messages.conversation_id
        AND c.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can delete own messages" ON public.conversation_messages;
CREATE POLICY "Users can delete own messages"
  ON public.conversation_messages FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.conversation_messages.conversation_id
        AND c.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

-- Summaries policies (scoped via conversation ownership)
DROP POLICY IF EXISTS "Users can view own summaries" ON public.conversation_summaries;
CREATE POLICY "Users can view own summaries"
  ON public.conversation_summaries FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.conversation_summaries.conversation_id
        AND c.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can insert summaries into own conversations" ON public.conversation_summaries;
CREATE POLICY "Users can insert summaries into own conversations"
  ON public.conversation_summaries FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.conversation_summaries.conversation_id
        AND c.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can update own summaries" ON public.conversation_summaries;
CREATE POLICY "Users can update own summaries"
  ON public.conversation_summaries FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.conversation_summaries.conversation_id
        AND c.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

DROP POLICY IF EXISTS "Users can delete own summaries" ON public.conversation_summaries;
CREATE POLICY "Users can delete own summaries"
  ON public.conversation_summaries FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = public.conversation_summaries.conversation_id
        AND c.user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text)
    )
  );

-- Grants (authenticated users only)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_summaries TO authenticated;
