"""Chat persistence service for storing messages in Supabase."""
import logging
from typing import List, Dict, Any, Optional
from datetime import datetime
from supabase import create_client, Client

from app.config import settings

logger = logging.getLogger(__name__)


class ChatPersistence:
    """
    Service for persisting chat messages to Supabase.

    Features:
    - Save messages to database
    - Load conversation history
    - Support for pagination
    - Session-based organization
    """

    def __init__(self):
        """Initialize chat persistence service."""
        self.client: Optional[Client] = None
        self._initialize()

    def _initialize(self):
        """Initialize Supabase client."""
        if not settings.supabase_url or not settings.supabase_service_key:
            logger.warning("Supabase credentials not configured for chat persistence")
            return

        try:
            self.client = create_client(
                settings.supabase_url,
                settings.supabase_service_key  # Use service key for admin operations
            )
            logger.info("✅ Chat persistence service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize chat persistence: {e}")

    async def save_message(
        self,
        session_id: str,
        role: str,
        content: str,
        user_id: Optional[str] = None,
        citations: Optional[List[Dict]] = None,
        confidence: Optional[float] = None,
        route: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> Optional[str]:
        """
        Save a chat message to the database.

        Args:
            session_id: Session identifier
            role: Message role ('user', 'assistant', 'system')
            content: Message content
            user_id: Optional user ID
            citations: Optional list of citations
            confidence: Optional confidence score
            route: Optional routing decision
            metadata: Optional additional metadata

        Returns:
            Message ID if successful, None otherwise
        """
        if not self.client:
            logger.warning("Chat persistence not initialized")
            return None

        try:
            # Build metadata with citations, confidence, route
            message_metadata = metadata or {}
            if citations:
                message_metadata["citations"] = citations
            if confidence is not None:
                message_metadata["confidence"] = confidence
            if route:
                message_metadata["route"] = route
            
            message_data = {
                "session_id": session_id,
                "role": role,
                "content": content,
                "metadata": message_metadata
            }

            result = self.client.table("messages").insert(message_data).execute()

            if result.data:
                message_id = result.data[0]["id"]
                logger.debug(f"Saved {role} message to session {session_id}: {message_id}")
                return message_id

            return None

        except Exception as e:
            logger.error(f"Error saving message: {e}")
            return None

    async def get_session_messages(
        self,
        session_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """
        Get messages for a session.

        Args:
            session_id: Session identifier
            limit: Maximum number of messages to return
            offset: Number of messages to skip (for pagination)

        Returns:
            List of message dictionaries
        """
        if not self.client:
            logger.warning("Chat persistence not initialized")
            return []

        try:
            result = self.client.table("messages")\
                .select("*")\
                .eq("session_id", session_id)\
                .order("created_at", desc=False)\
                .range(offset, offset + limit - 1)\
                .execute()

            if result.data:
                logger.debug(f"Retrieved {len(result.data)} messages for session {session_id}")
                return result.data

            return []

        except Exception as e:
            logger.error(f"Error retrieving messages: {e}")
            return []

    async def get_session_count(self, session_id: str) -> int:
        """
        Get the number of messages in a session.

        Args:
            session_id: Session identifier

        Returns:
            Number of messages
        """
        if not self.client:
            return 0

        try:
            result = self.client.table("messages")\
                .select("id", count="exact")\
                .eq("session_id", session_id)\
                .execute()

            return result.count if result.count else 0

        except Exception as e:
            logger.error(f"Error counting messages: {e}")
            return 0

    async def delete_session(self, session_id: str) -> bool:
        """
        Delete all messages in a session.

        Args:
            session_id: Session identifier

        Returns:
            True if successful, False otherwise
        """
        if not self.client:
            return False

        try:
            self.client.table("messages")\
                .delete()\
                .eq("session_id", session_id)\
                .execute()

            logger.info(f"Deleted all messages for session {session_id}")
            return True

        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            return False

    async def get_user_sessions(
        self,
        user_id: str,
        limit: int = 10
    ) -> List[Dict[str, Any]]:
        """
        Get recent sessions for a user.

        Args:
            user_id: User identifier
            limit: Maximum number of sessions to return

        Returns:
            List of session info dictionaries
        """
        if not self.client:
            return []

        try:
            # Get distinct sessions for the user with the latest message timestamp
            result = self.client.table("messages")\
                .select("session_id, created_at")\
                .order("created_at", desc=True)\
                .limit(limit * 10)\
                .execute()

            if not result.data:
                return []

            # Group by session_id and get the latest timestamp for each
            sessions = {}
            for row in result.data:
                session_id_val = row["session_id"]
                if session_id_val not in sessions:
                    sessions[session_id_val] = {
                        "session_id": session_id_val,
                        "last_message_at": row["created_at"]
                    }

            # Sort by last message time and limit
            sessions_list = list(sessions.values())
            sessions_list.sort(key=lambda x: x["last_message_at"], reverse=True)

            return sessions_list[:limit]

        except Exception as e:
            logger.error(f"Error retrieving user sessions: {e}")
            return []


# Global instance
chat_persistence = ChatPersistence()
