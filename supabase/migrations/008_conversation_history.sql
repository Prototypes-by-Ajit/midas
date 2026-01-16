-- Migration: Add conversation_history table for Phase 4 (Long-term Memory)
--
-- This table stores user interactions for conversation context.
-- Used by the ConversationMemory agent to maintain dialogue history.

CREATE TABLE IF NOT EXISTS conversation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,
    session_id TEXT NOT NULL,
    query TEXT NOT NULL,
    answer TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_id
    ON conversation_history(user_id);

-- Index for session lookups
CREATE INDEX IF NOT EXISTS idx_conversation_history_session_id
    ON conversation_history(session_id);

-- Index for time-based queries (recent history)
CREATE INDEX IF NOT EXISTS idx_conversation_history_created_at
    ON conversation_history(created_at DESC);

-- Composite index for user + time (most common query pattern)
CREATE INDEX IF NOT EXISTS idx_conversation_history_user_created
    ON conversation_history(user_id, created_at DESC);

-- Optional: Add TTL cleanup policy (delete records older than 30 days)
-- This can be run as a scheduled job via Supabase cron or Edge Function
-- For now, the memory_agent.clear_old_interactions() method handles this

COMMENT ON TABLE conversation_history IS 'Stores user conversation history for context-aware RAG';
COMMENT ON COLUMN conversation_history.metadata IS 'Stores confidence, grounding scores, and other interaction metadata';
