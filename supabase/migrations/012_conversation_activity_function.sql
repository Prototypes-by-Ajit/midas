-- ================================================================
-- Helper Function: Update Conversation Activity
-- ================================================================
-- This function atomically increments message_count and updates timestamps
-- Called when a new message is added to a conversation

CREATE OR REPLACE FUNCTION update_conversation_activity(conversation_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.conversations
  SET 
    message_count = message_count + 1,
    last_message_at = NOW(),
    updated_at = NOW()
  WHERE id = conversation_id;
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION update_conversation_activity(UUID) TO authenticated;

-- ================================================================
-- Trigger: Auto-update conversation on message insert
-- ================================================================
-- Automatically update conversation metadata when messages are added

CREATE OR REPLACE FUNCTION trigger_update_conversation_on_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update parent conversation
  UPDATE public.conversations
  SET 
    message_count = message_count + 1,
    last_message_at = NEW.created_at,
    updated_at = NOW()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Create trigger on conversation_messages table
DROP TRIGGER IF EXISTS conversation_messages_update_parent ON public.conversation_messages;

CREATE TRIGGER conversation_messages_update_parent
AFTER INSERT ON public.conversation_messages
FOR EACH ROW
EXECUTE FUNCTION trigger_update_conversation_on_message();

-- ================================================================
-- Helper Function: Get Conversation Summary
-- ================================================================
-- Returns conversation with recent message count and latest messages

CREATE OR REPLACE FUNCTION get_conversation_with_context(
  p_conversation_id UUID,
  p_message_limit INT DEFAULT 10
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'conversation', row_to_json(c.*),
    'recent_messages', (
      SELECT json_agg(m.*)
      FROM (
        SELECT id, role, content, created_at, metadata
        FROM public.conversation_messages
        WHERE conversation_id = p_conversation_id
        ORDER BY created_at DESC
        LIMIT p_message_limit
      ) m
    ),
    'summary', (
      SELECT row_to_json(s.*)
      FROM public.conversation_summaries s
      WHERE s.conversation_id = p_conversation_id
    )
  ) INTO result
  FROM public.conversations c
  WHERE c.id = p_conversation_id;
  
  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_conversation_with_context(UUID, INT) TO authenticated;
