-- Migration: Create documents and embeddings tables for RAG system
-- This creates the core tables needed for document indexing and retrieval

-- Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- ============================================================================
-- DOCUMENTS TABLE
-- ============================================================================
-- Stores metadata and content for uploaded documents
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    file_name TEXT,
    content TEXT,
    storage_path TEXT,
    source TEXT NOT NULL DEFAULT 'upload',
    source_type TEXT NOT NULL DEFAULT 'file', -- file, url, manual
    lesion_class TEXT, -- MEL, NV, BCC, AKIEC, BKL, DF, VASC
    tags TEXT[] DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'pending', -- pending, processing, processed, failed
    user_id TEXT, -- Clerk user ID
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add indexes for common queries (skip if columns don't exist yet)
DO $$
BEGIN
    -- Only create indexes if columns exist
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'status') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_status ON public.documents(status);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'source') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_source ON public.documents(source);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'lesion_class') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_lesion_class ON public.documents(lesion_class);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'user_id') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_user_id ON public.documents(user_id);
    END IF;

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'documents' AND column_name = 'created_at') THEN
        CREATE INDEX IF NOT EXISTS idx_documents_created_at ON public.documents(created_at DESC);
    END IF;
END $$;

-- ============================================================================
-- EMBEDDINGS TABLE
-- ============================================================================
-- Stores vector embeddings for document chunks (used for semantic search)
CREATE TABLE IF NOT EXISTS public.embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    document_id UUID NOT NULL REFERENCES public.documents(id) ON DELETE CASCADE,
    embedding vector(384), -- sentence-transformers/all-MiniLM-L6-v2 produces 384-dim vectors
    chunk_text TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_size INTEGER NOT NULL,
    model_version TEXT DEFAULT 'sentence-transformers/all-MiniLM-L6-v2',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for efficient vector similarity search
CREATE INDEX IF NOT EXISTS idx_embeddings_document_id ON public.embeddings(document_id);
CREATE INDEX IF NOT EXISTS idx_embeddings_vector ON public.embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- ============================================================================
-- VECTOR SIMILARITY SEARCH FUNCTION
-- ============================================================================
-- Function to search for similar document chunks using cosine similarity
CREATE OR REPLACE FUNCTION public.search_documents(
    query_embedding vector(384),
    match_threshold float DEFAULT 0.5,
    match_count int DEFAULT 10,
    filter_lesion_class text DEFAULT NULL
)
RETURNS TABLE (
    document_id uuid,
    chunk_text text,
    chunk_index integer,
    similarity float,
    title text,
    source text,
    lesion_class text,
    metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.document_id,
        e.chunk_text,
        e.chunk_index,
        1 - (e.embedding <=> query_embedding) AS similarity,
        d.title,
        d.source,
        d.lesion_class,
        d.metadata
    FROM public.embeddings e
    JOIN public.documents d ON e.document_id = d.id
    WHERE
        d.status = 'processed'
        AND (filter_lesion_class IS NULL OR d.lesion_class = filter_lesion_class)
        AND 1 - (e.embedding <=> query_embedding) > match_threshold
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_count;
END;
$$;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on both tables
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.embeddings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before recreating
DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access on documents" ON public.documents;
    DROP POLICY IF EXISTS "Service role full access on embeddings" ON public.embeddings;
    DROP POLICY IF EXISTS "Authenticated users can read processed documents" ON public.documents;
    DROP POLICY IF EXISTS "Authenticated users can read embeddings" ON public.embeddings;
    DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
    DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
    DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;
END $$;

-- Policy: Service role can do everything (for backend operations)
CREATE POLICY "Service role full access on documents"
    ON public.documents
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "Service role full access on embeddings"
    ON public.embeddings
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Policy: Authenticated users can read all processed documents
CREATE POLICY "Authenticated users can read processed documents"
    ON public.documents
    FOR SELECT
    TO authenticated
    USING (status = 'processed');

-- Policy: Authenticated users can read embeddings for processed documents
CREATE POLICY "Authenticated users can read embeddings"
    ON public.embeddings
    FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.documents
            WHERE id = embeddings.document_id
            AND status = 'processed'
        )
    );

-- Policy: Users can insert their own documents
CREATE POLICY "Users can insert own documents"
    ON public.documents
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can update their own pending/processing documents
CREATE POLICY "Users can update own documents"
    ON public.documents
    FOR UPDATE
    TO authenticated
    USING (auth.uid()::text = user_id)
    WITH CHECK (auth.uid()::text = user_id);

-- Policy: Users can delete their own documents
CREATE POLICY "Users can delete own documents"
    ON public.documents
    FOR DELETE
    TO authenticated
    USING (auth.uid()::text = user_id);

-- ============================================================================
-- UPDATED_AT TRIGGER
-- ============================================================================
-- Automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger if it exists before recreating
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- GRANTS
-- ============================================================================
-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Grant table permissions
GRANT ALL ON public.documents TO service_role;
GRANT ALL ON public.embeddings TO service_role;
GRANT SELECT ON public.documents TO authenticated, anon;
GRANT SELECT ON public.embeddings TO authenticated, anon;

-- Grant function execution
GRANT EXECUTE ON FUNCTION public.search_documents TO authenticated, service_role;
