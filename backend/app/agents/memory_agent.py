"""
Conversation Memory Agent for maintaining dialogue context.

Uses Supabase for persistent storage:
- conversation_history table for long-term storage
- search_cache table for query-level caching (existing)
"""

import logging
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class ConversationMemory:
    """
    Manages conversation history using Supabase persistence.

    Features:
    - Stores user interactions in conversation_history table
    - Retrieves relevant past context for queries
    - Formats history for LLM context injection
    """

    def __init__(self, supabase_client, memory_k: int = 3, ttl_days: int = 30):
        """
        Initialize conversation memory.

        Args:
            supabase_client: Supabase client for persistence
            memory_k: Number of relevant past interactions to retrieve
            ttl_days: Time-to-live for conversation history (default 30 days)
        """
        self.supabase = supabase_client
        self.memory_k = memory_k
        self.ttl_days = ttl_days

    async def add_interaction(
        self,
        user_id: str,
        session_id: str,
        query: str,
        answer: str,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """
        Store interaction in Supabase conversation_history table.

        Args:
            user_id: User identifier
            session_id: Session identifier
            query: User query
            answer: Generated answer
            metadata: Optional metadata (confidence, grounding, etc.)

        Returns:
            Stored interaction record
        """
        try:
            interaction = {
                "user_id": user_id,
                "session_id": session_id,
                "query": query,
                "answer": answer,
                "metadata": metadata or {},
                "created_at": datetime.utcnow().isoformat()
            }

            result = self.supabase.table("conversation_history").insert(interaction).execute()

            logger.debug(f"Stored interaction for user {user_id}, session {session_id}")
            return result.data[0] if result.data else {}

        except Exception as e:
            logger.error(f"Failed to store interaction: {e}")
            return {}

    async def get_recent_history(
        self,
        user_id: str,
        session_id: Optional[str] = None,
        n: int = 5
    ) -> List[Dict[str, Any]]:
        """
        Get N most recent interactions for a user (optionally filtered by session).

        Args:
            user_id: User identifier
            session_id: Optional session identifier for session-specific history
            n: Number of interactions to retrieve

        Returns:
            List of interaction dicts (most recent first)
        """
        try:
            query = self.supabase.table("conversation_history") \
                .select("*") \
                .eq("user_id", user_id)

            if session_id:
                query = query.eq("session_id", session_id)

            result = query.order("created_at", desc=True).limit(n).execute()

            logger.debug(f"Retrieved {len(result.data)} recent interactions for user {user_id}")
            return result.data

        except Exception as e:
            logger.error(f"Failed to retrieve recent history: {e}")
            return []

    async def get_relevant_history(
        self,
        user_id: str,
        current_query: str,
        k: Optional[int] = None
    ) -> List[Dict[str, Any]]:
        """
        Retrieve K most relevant past interactions.

        For simplicity, this returns recent interactions.
        Could be enhanced with semantic search over conversation_history.

        Args:
            user_id: User identifier
            current_query: Current user query (for semantic matching)
            k: Number of interactions to retrieve (uses self.memory_k if None)

        Returns:
            List of relevant interaction dicts
        """
        k = k or self.memory_k

        # Simple implementation: return recent history
        # Could be enhanced with semantic search using pgvector
        return await self.get_recent_history(user_id, n=k)

    def format_history_for_prompt(self, history: List[Dict[str, Any]]) -> str:
        """
        Format conversation history for LLM context injection.

        Args:
            history: List of interaction dicts

        Returns:
            Formatted history string
        """
        if not history:
            return ""

        formatted = "Previous conversation:\n\n"

        for i, interaction in enumerate(reversed(history), 1):  # Oldest first
            query = interaction.get("query", "")
            answer = interaction.get("answer", "")

            formatted += f"[Turn {i}]\n"
            formatted += f"User: {query}\n"
            formatted += f"Assistant: {answer[:150]}...\n\n"

        return formatted

    async def clear_old_interactions(self, days: Optional[int] = None) -> int:
        """
        Delete interactions older than TTL.

        Args:
            days: Age threshold in days (uses self.ttl_days if None)

        Returns:
            Number of interactions deleted
        """
        days = days or self.ttl_days

        try:
            cutoff_date = (datetime.utcnow() - timedelta(days=days)).isoformat()

            result = self.supabase.table("conversation_history") \
                .delete() \
                .lt("created_at", cutoff_date) \
                .execute()

            deleted_count = len(result.data) if result.data else 0
            logger.info(f"Deleted {deleted_count} interactions older than {days} days")

            return deleted_count

        except Exception as e:
            logger.error(f"Failed to clear old interactions: {e}")
            return 0

    def get_stats(self) -> Dict[str, Any]:
        """Get memory agent statistics."""
        return {
            "memory_k": self.memory_k,
            "ttl_days": self.ttl_days,
            "memory_enabled": True
        }
