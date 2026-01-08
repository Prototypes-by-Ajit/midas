-- ============================================================================
-- MIDAS RAG Database Schema for Supabase (FULLY FIXED)
-- PostgreSQL + pgvector, production-safe defaults, complete RLS, safe grants
-- NOTE:
--  - This script is designed for Supabase.
--  - service_role bypasses RLS by default (good for ingestion/workers).
--  - authenticated users get ONLY the minimal permissions needed.
-- ============================================================================

-- =========================
-- 0) EXTENSIONS
-- =========================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS vector;

-- =========================
-- 1) TABLES
-- =========================

-- 1.1 Sessions
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status VARCHAR(50) NOT NULL DEFAULT 'active',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 1.2 Messages
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  role VARCHAR(50) NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- RAG metadata
  confidence REAL,
  route VARCHAR(50) CHECK (route IN ('answer', 'clarify', 'refuse')),
  latency_ms INTEGER,
  tokens_used INTEGER,
  model_used VARCHAR(100),

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 1.3 Documents (Knowledge Base)
-- Intended to be curated content; users can READ (if you allow), but not write.
CREATE TABLE IF NOT EXISTS public.documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(500),
  content TEXT NOT NULL,
  source VARCHAR(500),
  source_type VARCHAR(50),

  lesion_class VARCHAR(50),
  tags TEXT[],

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version VARCHAR(50) NOT NULL DEFAULT '1.0.0',

  retrieval_count INTEGER NOT NULL DEFAULT 0,
  last_retrieved_at TIMESTAMPTZ,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

-- 1.4 Embeddings (pgvector chunks)
CREATE TABLE IF NOT EXISTS public.embeddings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,

  embedding vector(384) NOT NULL,     -- adjust if you change embedding model
  chunk_text TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  chunk_size INTEGER,

  model_version VARCHAR(100) NOT NULL DEFAULT 'all-MiniLM-L6-v2',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT embeddings_document_chunk_unique UNIQUE (document_id, chunk_index)
);

-- 1.5 Citations
CREATE TABLE IF NOT EXISTS public.citations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,

  content TEXT,
  relevance_score REAL,
  position INTEGER,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.6 Feedback
CREATE TABLE IF NOT EXISTS public.feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  message_id UUID NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,

  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  feedback_type VARCHAR(50),
  comment TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.7 Audit logs (traceability)
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  message_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,

  event_type VARCHAR(100) NOT NULL,
  event_data JSONB NOT NULL,

  trace_id VARCHAR(255),
  span_id VARCHAR(255),
  parent_span_id VARCHAR(255),

  duration_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 1.8 User Memory (long-term, domain-safe)
CREATE TABLE IF NOT EXISTS public.user_memory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL DEFAULT auth.uid(),

  memory_type VARCHAR(100) NOT NULL,
  key VARCHAR(255) NOT NULL,
  value JSONB NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  CONSTRAINT user_memory_unique UNIQUE (user_id, memory_type, key)
);

-- 1.9 Cache stats (aggregated performance)
CREATE TABLE IF NOT EXISTS public.cache_stats (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cache_layer VARCHAR(50) NOT NULL,

  hit_count INTEGER NOT NULL DEFAULT 0,
  miss_count INTEGER NOT NULL DEFAULT 0,
  last_hit_at TIMESTAMPTZ,

  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT cache_stats_period_valid CHECK (period_end >= period_start)
);

-- =========================
-- 2) INDEXES
-- =========================

-- Sessions
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_created_at ON public.sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);

-- Messages
CREATE INDEX IF NOT EXISTS idx_messages_session_id ON public.messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_role ON public.messages(role);
CREATE INDEX IF NOT EXISTS idx_messages_session_created ON public.messages(session_id, created_at DESC);

-- Documents
CREATE INDEX IF NOT EXISTS idx_documents_source_type ON public.documents(source_type);
CREATE INDEX IF NOT EXISTS idx_documents_lesion_class ON public.documents(lesion_class);
CREATE INDEX IF NOT EXISTS idx_documents_tags ON public.documents USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_source_class ON public.documents(source_type, lesion_class);

-- Embeddings
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON public.embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_created_at ON public.embeddings(created_at DESC);

-- Vector similarity index (IVFFLAT; requires ANALYZE after large inserts)
CREATE INDEX IF NOT EXISTS idx_embeddings_vector
ON public.embeddings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

-- Citations
CREATE INDEX IF NOT EXISTS idx_citations_message_id ON public.citations(message_id);
CREATE INDEX IF NOT EXISTS idx_citations_document_id ON public.citations(document_id);
CREATE INDEX IF NOT EXISTS idx_citations_relevance_score ON public.citations(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_citations_message_score ON public.citations(message_id, relevance_score DESC);

-- Feedback
CREATE INDEX IF NOT EXISTS idx_feedback_message_id ON public.feedback(message_id);
CREATE INDEX IF NOT EXISTS idx_feedback_session_id ON public.feedback(session_id);
CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.feedback(created_at DESC);

-- Audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_type ON public.audit_logs(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_trace_id ON public.audit_logs(trace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_session_id ON public.audit_logs(session_id);

-- User memory
CREATE INDEX IF NOT EXISTS idx_user_memory_user_id ON public.user_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_memory_type ON public.user_memory(memory_type);
CREATE INDEX IF NOT EXISTS idx_user_memory_expires_at ON public.user_memory(expires_at);

-- Cache stats
CREATE INDEX IF NOT EXISTS idx_cache_stats_layer ON public.cache_stats(cache_layer);
CREATE INDEX IF NOT EXISTS idx_cache_stats_period ON public.cache_stats(period_start, period_end);

-- =========================
-- 3) FUNCTIONS & TRIGGERS
-- =========================

-- Update updated_at only when row changes
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF ROW(NEW.*) IS DISTINCT FROM ROW(OLD.*) THEN
    NEW.updated_at = NOW();
  END IF;
  RETURN NEW;
END;
$$;

-- Sessions trigger
DROP TRIGGER IF EXISTS update_sessions_updated_at ON public.sessions;
CREATE TRIGGER update_sessions_updated_at
BEFORE UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Documents trigger
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;
CREATE TRIGGER update_documents_updated_at
BEFORE UPDATE ON public.documents
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User memory trigger
DROP TRIGGER IF EXISTS update_user_memory_updated_at ON public.user_memory;
CREATE TRIGGER update_user_memory_updated_at
BEFORE UPDATE ON public.user_memory
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================
-- 4) VECTOR SEARCH RPC (Respects RLS)
-- =========================
-- NOTE: SECURITY INVOKER (default) so RLS applies.
CREATE OR REPLACE FUNCTION public.search_documents(
  query_embedding vector(384),
  match_threshold DOUBLE PRECISION DEFAULT 0.5,
  match_count INTEGER DEFAULT 10,
  filter_lesion_class TEXT DEFAULT NULL
)
RETURNS TABLE (
  document_id UUID,
  chunk_text TEXT,
  similarity DOUBLE PRECISION,
  document_title VARCHAR,
  document_source VARCHAR,
  lesion_class VARCHAR
)
LANGUAGE plpgsql
STABLE
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.document_id,
    e.chunk_text,
    (1 - (e.embedding <=> query_embedding))::DOUBLE PRECISION AS similarity,
    d.title,
    d.source,
    d.lesion_class
  FROM public.embeddings e
  JOIN public.documents d ON e.document_id = d.id
  WHERE
    (filter_lesion_class IS NULL OR d.lesion_class = filter_lesion_class)
    AND (1 - (e.embedding <=> query_embedding)) > match_threshold
  ORDER BY similarity DESC
  LIMIT match_count;
END;
$$;

-- =========================
-- 5) ROW LEVEL SECURITY (COMPLETE)
-- =========================

-- 5.1 Enable RLS everywhere that contains user data
ALTER TABLE public.sessions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.citations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feedback    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_memory ENABLE ROW LEVEL SECURITY;

-- Also enable RLS on documents/embeddings so you can safely expose SELECT if desired.
-- If you want docs to be public to authenticated users, keep SELECT policy below.
ALTER TABLE public.documents   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings  ENABLE ROW LEVEL SECURITY;

-- =========================
-- 5.2 Sessions policies
-- =========================
DROP POLICY IF EXISTS "Users can view own sessions" ON public.sessions;
CREATE POLICY "Users can view own sessions"
ON public.sessions FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own sessions" ON public.sessions;
CREATE POLICY "Users can insert own sessions"
ON public.sessions FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own sessions" ON public.sessions;
CREATE POLICY "Users can update own sessions"
ON public.sessions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own sessions" ON public.sessions;
CREATE POLICY "Users can delete own sessions"
ON public.sessions FOR DELETE
USING (auth.uid() = user_id);

-- =========================
-- 5.3 Messages policies (ownership via session)
-- =========================
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
CREATE POLICY "Users can view own messages"
ON public.messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = public.messages.session_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert messages into own sessions" ON public.messages;
CREATE POLICY "Users can insert messages into own sessions"
ON public.messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = public.messages.session_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
CREATE POLICY "Users can update own messages"
ON public.messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = public.messages.session_id
      AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = public.messages.session_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
CREATE POLICY "Users can delete own messages"
ON public.messages FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = public.messages.session_id
      AND s.user_id = auth.uid()
  )
);

-- =========================
-- 5.4 Citations policies (ownership via message -> session)
-- =========================
DROP POLICY IF EXISTS "Users can view own citations" ON public.citations;
CREATE POLICY "Users can view own citations"
ON public.citations FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.sessions s ON s.id = m.session_id
    WHERE m.id = public.citations.message_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert own citations" ON public.citations;
CREATE POLICY "Users can insert own citations"
ON public.citations FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.sessions s ON s.id = m.session_id
    WHERE m.id = public.citations.message_id
      AND s.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete own citations" ON public.citations;
CREATE POLICY "Users can delete own citations"
ON public.citations FOR DELETE
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.sessions s ON s.id = m.session_id
    WHERE m.id = public.citations.message_id
      AND s.user_id = auth.uid()
  )
);

-- (Optional) Update citations policy if you need it:
DROP POLICY IF EXISTS "Users can update own citations" ON public.citations;
CREATE POLICY "Users can update own citations"
ON public.citations FOR UPDATE
USING (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.sessions s ON s.id = m.session_id
    WHERE m.id = public.citations.message_id
      AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.messages m
    JOIN public.sessions s ON s.id = m.session_id
    WHERE m.id = public.citations.message_id
      AND s.user_id = auth.uid()
  )
);

-- =========================
-- 5.5 Feedback policies (ownership via session)
-- =========================
DROP POLICY IF EXISTS "Users can manage own feedback" ON public.feedback;
CREATE POLICY "Users can manage own feedback"
ON public.feedback FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = public.feedback.session_id
      AND s.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = public.feedback.session_id
      AND s.user_id = auth.uid()
  )
);

-- =========================
-- 5.6 Audit logs policies (read-only for owners)
-- =========================
DROP POLICY IF EXISTS "Users can view own audit logs" ON public.audit_logs;
CREATE POLICY "Users can view own audit logs"
ON public.audit_logs FOR SELECT
USING (
  session_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.sessions s
    WHERE s.id = public.audit_logs.session_id
      AND s.user_id = auth.uid()
  )
);

-- If you want users to insert audit logs (often backend-only), keep INSERT disabled.
-- If needed, uncomment:
-- DROP POLICY IF EXISTS "Users can insert own audit logs" ON public.audit_logs;
-- CREATE POLICY "Users can insert own audit logs"
-- ON public.audit_logs FOR INSERT
-- WITH CHECK (
--   session_id IS NOT NULL AND EXISTS (
--     SELECT 1 FROM public.sessions s
--     WHERE s.id = public.audit_logs.session_id
--       AND s.user_id = auth.uid()
--   )
-- );

-- =========================
-- 5.7 User memory policies
-- =========================
DROP POLICY IF EXISTS "Users can view own memory" ON public.user_memory;
CREATE POLICY "Users can view own memory"
ON public.user_memory FOR SELECT
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own memory" ON public.user_memory;
CREATE POLICY "Users can insert own memory"
ON public.user_memory FOR INSERT
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own memory" ON public.user_memory;
CREATE POLICY "Users can update own memory"
ON public.user_memory FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own memory" ON public.user_memory;
CREATE POLICY "Users can delete own memory"
ON public.user_memory FOR DELETE
USING (auth.uid() = user_id);

-- =========================
-- 5.8 Documents & embeddings policies (READ for authenticated; WRITE blocked)
-- =========================
-- If your knowledge base is global and safe to expose to logged-in users:
DROP POLICY IF EXISTS "Authenticated can read documents" ON public.documents;
CREATE POLICY "Authenticated can read documents"
ON public.documents FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Authenticated can read embeddings" ON public.embeddings;
CREATE POLICY "Authenticated can read embeddings"
ON public.embeddings FOR SELECT
TO authenticated
USING (true);

-- NOTE: No INSERT/UPDATE/DELETE policies are created for documents/embeddings.
-- Therefore, even if someone had privileges, RLS blocks writes (service_role bypasses RLS).

-- =========================
-- 6) OPTIONAL SAMPLE DATA (SAFE)
-- =========================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.documents LIMIT 1) THEN
    INSERT INTO public.documents (title, content, source, source_type, lesion_class, tags)
    VALUES (
      'Melanoma ABCDE Rule',
      'The ABCDE rule for melanoma detection: Asymmetry, Border irregularity, Color variation, Diameter >6mm, Evolving over time.',
      'Clinical Guidelines',
      'guideline',
      'MEL',
      ARRAY['melanoma', 'abcde', 'detection']
    );
  END IF;
END $$;

-- =========================
-- 7) PERMISSIONS (MINIMAL, SAFE)
-- =========================

-- Ensure authenticated can use public schema
GRANT USAGE ON SCHEMA public TO authenticated;

-- Revoke broad defaults (defense in depth)
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- Allow app tables CRUD (RLS still applies)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.messages    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.citations   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_memory TO authenticated;

-- Audit logs: SELECT only (recommended)
GRANT SELECT ON public.audit_logs TO authenticated;

-- Documents/embeddings: SELECT only (recommended)
GRANT SELECT ON public.documents  TO authenticated;
GRANT SELECT ON public.embeddings TO authenticated;

-- Cache stats: SELECT only (or none; choose what you need)
GRANT SELECT ON public.cache_stats TO authenticated;

-- Functions: allow authenticated to execute search RPC
GRANT EXECUTE ON FUNCTION public.search_documents(vector(384), double precision, integer, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO authenticated;

-- =========================
-- 8) PERFORMANCE NOTE
-- =========================
-- After large embedding inserts, run:
--   ANALYZE public.embeddings;
-- for better ivfflat recall/latency.

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
