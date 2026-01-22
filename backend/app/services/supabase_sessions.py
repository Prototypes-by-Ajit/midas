"""Supabase session service for managing conversations table."""
import logging
import httpx
from typing import List, Dict, Any, Optional
from datetime import datetime
from supabase import create_client, Client

from app.config import settings

logger = logging.getLogger(__name__)


class SupabaseSessionService:
    """
    Service for managing chat sessions via Supabase conversations table.
    
    Maps to:
    - conversations table (persistent chat history)
    - conversation_messages table (all user/assistant turns)
    - conversation_summaries table (compressed history)
    - session_cache edge function (short-term memory)
    """
    
    def __init__(self):
        """Initialize Supabase session service."""
        self.client: Optional[Client] = None
        self.edge_function_url: Optional[str] = None
        self._initialize()
    
    def _initialize(self):
        """Initialize Supabase client and edge function URL."""
        if not settings.supabase_url or not settings.supabase_service_key:
            logger.warning("Supabase credentials not configured for session service")
            return
        
        try:
            self.client = create_client(
                settings.supabase_url,
                settings.supabase_service_key  # Service key for admin operations
            )
            
            # Edge function URL for conversation-cache
            self.edge_function_url = f"{settings.supabase_url}/functions/v1/conversation-cache"
            
            logger.info("✅ Supabase session service initialized")
        except Exception as e:
            logger.error(f"Failed to initialize session service: {e}")
    
    async def create_session(
        self,
        user_id: str,
        title: Optional[str] = None,
        context: Optional[Dict[str, Any]] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Create a new conversation/session.
        
        Args:
            user_id: User identifier (from Clerk/Auth)
            title: Optional session title
            context: Optional initial context (lesion class, prediction, etc.)
        
        Returns:
            Created session dictionary or None
        """
        if not self.client:
            logger.warning("Session service not initialized")
            return None
        
        try:
            session_data = {
                "user_id": user_id,
                "title": title or f"Chat {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                "status": "active",
                "message_count": 0,
                "metadata": context or {}
            }
            
            result = self.client.table("conversations").insert(session_data).execute()
            
            if result.data:
                logger.info(f"Created session for user {user_id}: {result.data[0]['id']}")
                return result.data[0]
            
            return None
        
        except Exception as e:
            logger.error(f"Error creating session: {e}")
            return None
    
    async def get_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Get session by ID.
        
        Args:
            session_id: Session identifier
        
        Returns:
            Session dictionary or None
        """
        if not self.client:
            return None
        
        try:
            result = self.client.table("conversations")\
                .select("*")\
                .eq("id", session_id)\
                .single()\
                .execute()
            
            if result.data:
                return result.data
            
            return None
        
        except Exception as e:
            logger.error(f"Error getting session: {e}")
            return None
    
    async def list_sessions(
        self,
        user_id: str,
        limit: int = 50,
        offset: int = 0
    ) -> Dict[str, Any]:
        """
        List sessions for a user.
        
        Args:
            user_id: User identifier
            limit: Max sessions to return
            offset: Pagination offset
        
        Returns:
            Dictionary with sessions list and total count
        """
        if not self.client:
            return {"sessions": [], "total": 0}
        
        try:
            # Get total count
            count_result = self.client.table("conversations")\
                .select("id", count="exact")\
                .eq("user_id", user_id)\
                .execute()
            
            total = count_result.count if count_result.count else 0
            
            # Get paginated sessions
            result = self.client.table("conversations")\
                .select("*")\
                .eq("user_id", user_id)\
                .order("last_message_at", desc=True)\
                .range(offset, offset + limit - 1)\
                .execute()
            
            sessions = result.data if result.data else []
            
            logger.debug(f"Listed {len(sessions)}/{total} sessions for user {user_id}")
            
            return {
                "sessions": sessions,
                "total": total
            }
        
        except Exception as e:
            logger.error(f"Error listing sessions: {e}")
            return {"sessions": [], "total": 0}
    
    async def update_session(
        self,
        session_id: str,
        updates: Dict[str, Any]
    ) -> Optional[Dict[str, Any]]:
        """
        Update session metadata.
        
        Args:
            session_id: Session identifier
            updates: Dictionary of fields to update
        
        Returns:
            Updated session or None
        """
        if not self.client:
            return None
        
        try:
            # Add updated_at timestamp
            updates["updated_at"] = datetime.utcnow().isoformat()
            
            result = self.client.table("conversations")\
                .update(updates)\
                .eq("id", session_id)\
                .execute()
            
            if result.data:
                logger.info(f"Updated session {session_id}")
                return result.data[0]
            
            return None
        
        except Exception as e:
            logger.error(f"Error updating session: {e}")
            return None
    
    async def update_session_activity(self, session_id: str) -> bool:
        """
        Update last_message_at and increment message_count.
        
        Called automatically when a message is added.
        
        Args:
            session_id: Session identifier
        
        Returns:
            True if successful
        """
        if not self.client:
            return False
        
        try:
            # Use SQL function to atomically increment and update timestamp
            result = self.client.rpc(
                "update_conversation_activity",
                {"conversation_id": session_id}
            ).execute()
            
            return True
        
        except Exception as e:
            # Fallback to manual update if function doesn't exist
            logger.warning(f"RPC function not found, using fallback: {e}")
            
            try:
                result = self.client.table("conversations")\
                    .update({
                        "last_message_at": datetime.utcnow().isoformat(),
                        "updated_at": datetime.utcnow().isoformat()
                    })\
                    .eq("id", session_id)\
                    .execute()
                
                return bool(result.data)
            
            except Exception as e2:
                logger.error(f"Error updating session activity: {e2}")
                return False
    
    async def delete_session(self, session_id: str) -> bool:
        """
        Delete a session (cascades to messages, summaries, cache).
        
        Args:
            session_id: Session identifier
        
        Returns:
            True if successful
        """
        if not self.client:
            return False
        
        try:
            self.client.table("conversations")\
                .delete()\
                .eq("id", session_id)\
                .execute()
            
            logger.info(f"Deleted session {session_id}")
            return True
        
        except Exception as e:
            logger.error(f"Error deleting session: {e}")
            return False
    
    # ============================================
    # Edge Function Integration
    # ============================================
    
    async def get_session_cache(
        self,
        session_id: str,
        limit: int = 8,
        include_summary: bool = False,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Get cached conversation context via edge function.
        
        Args:
            session_id: Session identifier
            limit: Number of recent messages to return
            include_summary: Whether to include conversation summary
            auth_token: Authorization Bearer token
        
        Returns:
            Cache data with recent messages and optional summary
        """
        if not self.edge_function_url:
            logger.warning("Edge function URL not configured")
            return {"error": "Edge function not available"}
        
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = auth_token
            else:
                # Use service key as fallback
                headers["Authorization"] = f"Bearer {settings.supabase_service_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.edge_function_url,
                    json={
                        "session_id": session_id,
                        "limit": limit,
                        "include_summary": include_summary
                    },
                    headers=headers,
                    timeout=10.0
                )
                
                response.raise_for_status()
                return response.json()
        
        except Exception as e:
            logger.error(f"Error calling edge function: {e}")
            return {"error": str(e)}
    
    async def refresh_session_cache(
        self,
        session_id: str,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Force refresh of session cache.
        
        Args:
            session_id: Session identifier
            auth_token: Authorization Bearer token
        
        Returns:
            Refreshed cache data
        """
        if not self.edge_function_url:
            return {"error": "Edge function not available"}
        
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = auth_token
            else:
                headers["Authorization"] = f"Bearer {settings.supabase_service_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.edge_function_url,
                    json={
                        "session_id": session_id,
                        "action": "refresh"
                    },
                    headers=headers,
                    timeout=10.0
                )
                
                response.raise_for_status()
                return response.json()
        
        except Exception as e:
            logger.error(f"Error refreshing cache: {e}")
            return {"error": str(e)}
    
    async def clear_session_cache(
        self,
        session_id: str,
        auth_token: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Clear session cache.
        
        Args:
            session_id: Session identifier
            auth_token: Authorization Bearer token
        
        Returns:
            Success response
        """
        if not self.edge_function_url:
            return {"error": "Edge function not available"}
        
        try:
            headers = {}
            if auth_token:
                headers["Authorization"] = auth_token
            else:
                headers["Authorization"] = f"Bearer {settings.supabase_service_key}"
            
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.edge_function_url,
                    json={
                        "session_id": session_id,
                        "action": "clear"
                    },
                    headers=headers,
                    timeout=10.0
                )
                
                response.raise_for_status()
                return response.json()
        
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
            return {"error": str(e)}


# Global instance
supabase_session_service = SupabaseSessionService()
