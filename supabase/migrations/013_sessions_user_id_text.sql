-- Ensure sessions/messages user_id can store Clerk user IDs (non-UUID)

-- Drop all policies that depend on user_id columns
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename IN ('sessions', 'messages', 'citations')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Drop foreign key on sessions.user_id if present
DO $$
DECLARE
  fk_name text;
BEGIN
  SELECT conname INTO fk_name
  FROM pg_constraint
  WHERE conrelid = 'public.sessions'::regclass
    AND contype = 'f'
    AND conkey = ARRAY[
      (SELECT attnum
       FROM pg_attribute
       WHERE attrelid = 'public.sessions'::regclass
         AND attname = 'user_id')
    ];

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.sessions DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

-- Alter user_id columns to TEXT
ALTER TABLE public.sessions
  ALTER COLUMN user_id TYPE TEXT
  USING user_id::text;

ALTER TABLE public.messages
  ALTER COLUMN user_id TYPE TEXT
  USING user_id::text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'citations'
      AND column_name = 'user_id'
  ) THEN
    EXECUTE 'ALTER TABLE public.citations ALTER COLUMN user_id TYPE TEXT USING user_id::text';
  END IF;
END $$;

-- Recreate policies with TEXT user_id
CREATE POLICY "Users can view own sessions"
  ON public.sessions FOR SELECT
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can insert own sessions"
  ON public.sessions FOR INSERT
  WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can update own sessions"
  ON public.sessions FOR UPDATE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can delete own sessions"
  ON public.sessions FOR DELETE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can view own messages"
  ON public.messages FOR SELECT
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can insert own messages"
  ON public.messages FOR INSERT
  WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can update own messages"
  ON public.messages FOR UPDATE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can delete own messages"
  ON public.messages FOR DELETE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can view own citations"
  ON public.citations FOR SELECT
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can insert own citations"
  ON public.citations FOR INSERT
  WITH CHECK (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can update own citations"
  ON public.citations FOR UPDATE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE POLICY "Users can delete own citations"
  ON public.citations FOR DELETE
  USING (user_id = COALESCE(auth.jwt() ->> 'sub', auth.uid()::text));

CREATE INDEX IF NOT EXISTS idx_sessions_user_id
  ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id
  ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_citations_user_id
  ON public.citations(user_id);
