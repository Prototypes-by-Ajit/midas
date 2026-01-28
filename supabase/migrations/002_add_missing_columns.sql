-- Migration: Add missing columns to existing documents table
-- This adds columns that were missing from the original schema

-- Add missing columns to documents table if they don't exist
DO $$
BEGIN
    -- Add user_id column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'user_id'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN user_id TEXT;
        CREATE INDEX idx_documents_user_id ON public.documents(user_id);
    END IF;

    -- Add file_name column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'file_name'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN file_name TEXT;
    END IF;

    -- Add storage_path column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'storage_path'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN storage_path TEXT;
    END IF;

    -- Add source_type column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'source_type'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN source_type TEXT NOT NULL DEFAULT 'file';
    END IF;

    -- Add tags column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN tags TEXT[] DEFAULT '{}';
    END IF;

    -- Add status column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'status'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN status TEXT NOT NULL DEFAULT 'pending';
        CREATE INDEX idx_documents_status ON public.documents(status);
    END IF;

    -- Add updated_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'documents'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.documents ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
    END IF;
END $$;

-- Create missing indexes if they don't exist
DO $$
BEGIN
    -- Create index on created_at if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'documents'
        AND indexname = 'idx_documents_created_at'
    ) THEN
        CREATE INDEX idx_documents_created_at ON public.documents(created_at DESC);
    END IF;

    -- Create index on source if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'documents'
        AND indexname = 'idx_documents_source'
    ) THEN
        CREATE INDEX idx_documents_source ON public.documents(source);
    END IF;
END $$;

-- Create or replace the updated_at trigger
DROP TRIGGER IF EXISTS update_documents_updated_at ON public.documents;

CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON public.documents
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Update existing RLS policies for documents table
DO $$
BEGIN
    -- Drop existing policies if they exist
    DROP POLICY IF EXISTS "Users can insert own documents" ON public.documents;
    DROP POLICY IF EXISTS "Users can update own documents" ON public.documents;
    DROP POLICY IF EXISTS "Users can delete own documents" ON public.documents;

    -- Recreate policies with user_id column
    CREATE POLICY "Users can insert own documents"
        ON public.documents
        FOR INSERT
        TO authenticated
        WITH CHECK (auth.uid()::text = user_id);

    CREATE POLICY "Users can update own documents"
        ON public.documents
        FOR UPDATE
        TO authenticated
        USING (auth.uid()::text = user_id)
        WITH CHECK (auth.uid()::text = user_id);

    CREATE POLICY "Users can delete own documents"
        ON public.documents
        FOR DELETE
        TO authenticated
        USING (auth.uid()::text = user_id);
EXCEPTION
    WHEN undefined_function THEN
        -- If auth.uid() doesn't exist (not using Supabase Auth), skip user policies
        RAISE NOTICE 'Skipping user policies - auth.uid() not available';
END $$;

-- Ensure embeddings table has all required columns
DO $$
BEGIN
    -- Add model_version column if missing
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'embeddings'
        AND column_name = 'model_version'
    ) THEN
        ALTER TABLE public.embeddings ADD COLUMN model_version TEXT DEFAULT 'sentence-transformers/all-MiniLM-L6-v2';
    END IF;
END $$;

-- Create embeddings indexes if they don't exist
DO $$
BEGIN
    -- Create index on document_id
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'embeddings'
        AND indexname = 'idx_embeddings_document_id'
    ) THEN
        CREATE INDEX idx_embeddings_document_id ON public.embeddings(document_id);
    END IF;

    -- Create vector index (ivfflat for cosine similarity)
    IF NOT EXISTS (
        SELECT 1 FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = 'embeddings'
        AND indexname = 'idx_embeddings_vector'
    ) THEN
        CREATE INDEX idx_embeddings_vector ON public.embeddings
        USING ivfflat (embedding vector_cosine_ops)
        WITH (lists = 100);
    END IF;
END $$;

-- Recreate search_documents function (drop first if signature changed)
DROP FUNCTION IF EXISTS public.search_documents(vector, float, int, text);
DROP FUNCTION IF EXISTS public.search_documents(vector, double precision, integer, text);

CREATE FUNCTION public.search_documents(
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

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION public.search_documents TO authenticated, service_role;

-- Show completion message
DO $$
BEGIN
    RAISE NOTICE 'Migration completed successfully!';
    RAISE NOTICE 'Added missing columns: user_id, file_name, storage_path, source_type, tags, status, updated_at';
    RAISE NOTICE 'Created missing indexes';
    RAISE NOTICE 'Updated RLS policies';
    RAISE NOTICE 'Updated search_documents function';
END $$;
