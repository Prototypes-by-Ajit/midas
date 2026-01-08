"""Session memory for short-term conversation context."""
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging

from app.cache import cache_manager
from app.mcp.policies import MemoryPolicy
from app.config import settings

logger = logging.getLogger(__name__)


class SessionMemory:
    """
    Short-term memory for conversation context.
    
    Stores:
    - Last N conversation turns
    - Current prediction context (lesion class, confidence)
    - Current heatmap metadata
    """
    
    def __init__(self):
        """Initialize session memory."""
        self.max_turns = settings.session_memory_max_turns
        self.token_budget = settings.session_memory_token_budget
        self.ttl = settings.redis_cache_ttl_session
    
    def _get_key(self, session_id: str) -> str:
        """Get cache key for session."""
        return f"session:{session_id}"
    
    def get_turns(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get conversation turns for a session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            List of conversation turns
        """
        key = self._get_key(session_id)
        turns = cache_manager.get(key, namespace="session_memory")
        
        if turns is None:
            return []
        
        logger.debug(f"Retrieved {len(turns)} turns for session {session_id}")
        return turns
    
    def add_turn(
        self,
        session_id: str,
        role: str,
        content: str,
        metadata: Optional[Dict[str, Any]] = None
    ):
        """
        Add a conversation turn to session memory.
        
        Args:
            session_id: Session identifier
            role: 'user' or 'assistant'
            content: Message content
            metadata: Optional metadata (route, confidence, etc.)
        """
        # Get existing turns
        turns = self.get_turns(session_id)
        
        # Create new turn
        turn = {
            "role": role,
            "content": content,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": metadata or {}
        }
        
        # Add to turns
        turns.append(turn)
        
        # Trim to max turns
        if len(turns) > self.max_turns:
            turns = turns[-self.max_turns:]
            logger.debug(f"Trimmed session {session_id} to {self.max_turns} turns")
        
        # Save back to cache
        key = self._get_key(session_id)
        cache_manager.set(key, turns, ttl=self.ttl, namespace="session_memory")
        
        logger.debug(f"Added {role} turn to session {session_id} ({len(turns)} total)")
    
    def set_context(
        self,
        session_id: str,
        context: Dict[str, Any]
    ):
        """
        Set current context for session (lesion class, prediction, etc.).
        
        Args:
            session_id: Session identifier
            context: Context dictionary
        """
        key = f"{self._get_key(session_id)}:context"
        cache_manager.set(key, context, ttl=self.ttl, namespace="session_memory")
        
        logger.debug(f"Set context for session {session_id}: {list(context.keys())}")
    
    def get_context(self, session_id: str) -> Dict[str, Any]:
        """
        Get current context for session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Context dictionary
        """
        key = f"{self._get_key(session_id)}:context"
        context = cache_manager.get(key, namespace="session_memory")
        
        return context if context else {}
    
    def get_summary(self, session_id: str) -> str:
        """
        Get a summary of the conversation for context.
        
        Args:
            session_id: Session identifier
            
        Returns:
            Conversation summary
        """
        turns = self.get_turns(session_id)
        context = self.get_context(session_id)
        
        if not turns and not context:
            return ""
        
        # Build summary
        summary_parts = []
        
        # Add context if present
        if context:
            if "lesion_class" in context:
                summary_parts.append(f"Current lesion: {context['lesion_class']}")
            if "prediction_confidence" in context:
                summary_parts.append(f"Confidence: {context['prediction_confidence']:.2f}")
        
        # Add recent turns
        if turns:
            recent = turns[-3:]  # Last 3 turns
            for turn in recent:
                content_preview = turn["content"][:100]
                summary_parts.append(f"{turn['role']}: {content_preview}")
        
        return "\n".join(summary_parts)
    
    def clear(self, session_id: str):
        """
        Clear session memory.
        
        Args:
            session_id: Session identifier
        """
        key = self._get_key(session_id)
        context_key = f"{key}:context"
        
        cache_manager.delete(key, namespace="session_memory")
        cache_manager.delete(context_key, namespace="session_memory")
        
        logger.info(f"Cleared session memory for {session_id}")
    
    def get_turn_count(self, session_id: str) -> int:
        """Get number of turns in session."""
        turns = self.get_turns(session_id)
        return len(turns)


# Global instance
session_memory = SessionMemory()
