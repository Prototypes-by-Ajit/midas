-- B+ Tree Indexing Schema for Efficient Chunk Management
-- This migration adds support for B+ tree-based chunk indexing in Supabase

-- ============================================================================
-- 1. Create chunk_index table for B+ tree metadata
-- ============================================================================

CREATE TABLE IF NOT EXISTS chunk_index (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL DEFAULT 'default',
    document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    chunk_id INTEGER NOT NULL,
    start_char INTEGER NOT NULL,
    end_char INTEGER NOT NULL,
    content_hash TEXT NOT NULL,
    chunk_text TEXT NOT NULL,
    lesion_class TEXT,
    source TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Composite unique constraint for B+ tree key
    UNIQUE(tenant_id, document_id, chunk_id)
);

-- ============================================================================
-- 2. Create indexes for efficient B+ tree operations
-- ============================================================================

-- Index for composite key lookups (tenant, doc, chunk)
CREATE INDEX IF NOT EXISTS idx_chunk_index_composite 
ON chunk_index(tenant_id, document_id, chunk_id);

-- Index for document-level scans
CREATE INDEX IF NOT EXISTS idx_chunk_index_doc 
ON chunk_index(tenant_id, document_id);

-- Index for content hash deduplication
CREATE INDEX IF NOT EXISTS idx_chunk_index_hash 
ON chunk_index(content_hash);

-- Index for lesion class filtering
CREATE INDEX IF NOT EXISTS idx_chunk_index_lesion 
ON chunk_index(lesion_class) 
WHERE lesion_class IS NOT NULL;

-- ============================================================================
-- 3. Create function for getting chunk neighbors (B+ tree range query)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_chunk_neighbors(
    p_tenant_id TEXT,
    p_document_id UUID,
    p_chunk_id INTEGER,
    p_window INTEGER DEFAULT 2
)
RETURNS TABLE (
    chunk_id INTEGER,
    chunk_text TEXT,
    start_char INTEGER,
    end_char INTEGER,
    content_hash TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.chunk_id,
        ci.chunk_text,
        ci.start_char,
        ci.end_char,
        ci.content_hash
    FROM chunk_index ci
    WHERE 
        ci.tenant_id = p_tenant_id
        AND ci.document_id = p_document_id
        AND ci.chunk_id >= GREATEST(0, p_chunk_id - p_window)
        AND ci.chunk_id <= p_chunk_id + p_window
    ORDER BY ci.chunk_id ASC;
END;
$$;

-- ============================================================================
-- 4. Create function for getting document chunks (B+ tree document scan)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_document_chunks(
    p_tenant_id TEXT,
    p_document_id UUID
)
RETURNS TABLE (
    chunk_id INTEGER,
    chunk_text TEXT,
    start_char INTEGER,
    end_char INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.chunk_id,
        ci.chunk_text,
        ci.start_char,
        ci.end_char
    FROM chunk_index ci
    WHERE 
        ci.tenant_id = p_tenant_id
        AND ci.document_id = p_document_id
    ORDER BY ci.chunk_id ASC;
END;
$$;

-- ============================================================================
-- 5. Create function for chunk range query (B+ tree range scan)
-- ============================================================================

CREATE OR REPLACE FUNCTION get_chunk_range(
    p_tenant_id TEXT,
    p_document_id UUID,
    p_start_chunk_id INTEGER,
    p_end_chunk_id INTEGER
)
RETURNS TABLE (
    chunk_id INTEGER,
    chunk_text TEXT,
    start_char INTEGER,
    end_char INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.chunk_id,
        ci.chunk_text,
        ci.start_char,
        ci.end_char
    FROM chunk_index ci
    WHERE 
        ci.tenant_id = p_tenant_id
        AND ci.document_id = p_document_id
        AND ci.chunk_id >= p_start_chunk_id
        AND ci.chunk_id <= p_end_chunk_id
    ORDER BY ci.chunk_id ASC;
END;
$$;

-- ============================================================================
-- 6. Create function for finding duplicate chunks
-- ============================================================================

CREATE OR REPLACE FUNCTION find_duplicate_chunks(
    p_content_hash TEXT
)
RETURNS TABLE (
    document_id UUID,
    chunk_id INTEGER,
    chunk_text TEXT,
    source TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ci.document_id,
        ci.chunk_id,
        ci.chunk_text,
        ci.source
    FROM chunk_index ci
    WHERE ci.content_hash = p_content_hash
    ORDER BY ci.document_id, ci.chunk_id;
END;
$$;

-- ============================================================================
-- 7. Create function for chunk index statistics
-- ============================================================================

CREATE OR REPLACE FUNCTION get_chunk_index_stats()
RETURNS TABLE (
    total_chunks BIGINT,
    unique_hashes BIGINT,
    avg_chunks_per_hash NUMERIC,
    total_documents BIGINT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::BIGINT AS total_chunks,
        COUNT(DISTINCT content_hash)::BIGINT AS unique_hashes,
        ROUND(COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT content_hash), 0), 2) AS avg_chunks_per_hash,
        COUNT(DISTINCT document_id)::BIGINT AS total_documents
    FROM chunk_index;
END;
$$;

-- ============================================================================
-- 8. Create trigger to sync with embeddings table
-- ============================================================================

CREATE OR REPLACE FUNCTION sync_chunk_to_embedding()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- When a chunk is inserted, ensure corresponding embedding exists
    -- This is informational only - embedding creation handled by app
    -- Just log the event
    RAISE NOTICE 'Chunk indexed: doc=%, chunk=%', NEW.document_id, NEW.chunk_id;
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_sync_chunk_to_embedding
AFTER INSERT ON chunk_index
FOR EACH ROW
EXECUTE FUNCTION sync_chunk_to_embedding();

-- ============================================================================
-- 9. Add RLS policies for multi-tenancy
-- ============================================================================

ALTER TABLE chunk_index ENABLE ROW LEVEL SECURITY;

-- Policy: Users can read chunks from their tenant
CREATE POLICY chunk_index_select_policy
ON chunk_index
FOR SELECT
USING (
    tenant_id = current_setting('app.tenant_id', TRUE)
    OR current_setting('app.tenant_id', TRUE) IS NULL
);

-- Policy: Service role can insert chunks
CREATE POLICY chunk_index_insert_policy
ON chunk_index
FOR INSERT
WITH CHECK (TRUE);

-- Policy: Service role can delete chunks
CREATE POLICY chunk_index_delete_policy
ON chunk_index
FOR DELETE
USING (TRUE);

-- ============================================================================
-- 10. Grant permissions
-- ============================================================================

GRANT SELECT, INSERT, DELETE ON chunk_index TO authenticated;
GRANT SELECT ON chunk_index TO anon;

GRANT EXECUTE ON FUNCTION get_chunk_neighbors TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_document_chunks TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_chunk_range TO authenticated, anon;
GRANT EXECUTE ON FUNCTION find_duplicate_chunks TO authenticated, anon;
GRANT EXECUTE ON FUNCTION get_chunk_index_stats TO authenticated, anon;

-- ============================================================================
-- Comments for documentation
-- ============================================================================

COMMENT ON TABLE chunk_index IS 
'B+ tree indexed chunk storage for efficient range queries and neighbor retrieval';

COMMENT ON FUNCTION get_chunk_neighbors IS 
'Retrieve neighboring chunks for context expansion in RAG';

COMMENT ON FUNCTION get_document_chunks IS 
'Get all chunks for a document in sequential order';

COMMENT ON FUNCTION get_chunk_range IS 
'B+ tree range query for retrieving chunk sequences';

COMMENT ON FUNCTION find_duplicate_chunks IS 
'Find duplicate chunks across documents by content hash';

COMMENT ON FUNCTION get_chunk_index_stats IS 
'Get statistics about chunk index for monitoring';
