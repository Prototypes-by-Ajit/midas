"""Router Agent - Routes queries to appropriate specialized agent."""
import re
import logging
from typing import Dict, Any, Optional, List
from enum import Enum

logger = logging.getLogger(__name__)


class AgentType(str, Enum):
    """Available agent types."""
    RAG_AGENT = "rag_agent"
    WEB_SCRAPING_AGENT = "web_scraping_agent"


class RouterAgent:
    """
    Router agent that classifies queries and routes to appropriate agent.
    
    Routing Logic:
    - Contains URL → Web Scraping Agent (Tavily MCP)
    - Requests links/URLs → Web Scraping Agent (Tavily MCP)
    - Medical question → RAG Agent (default)
    """
    
    def __init__(self):
        """Initialize router agent."""
        self.url_pattern = r'https?://[\S]+'
        # Patterns that indicate user wants links/URLs
        self.link_request_patterns = [
            r'\b(hyperlink|hyper-link|link|url|website|web ?site|source)s?\b',
            r'\b(find|get|give|show|provide).*\b(link|url|website|source)s?\b',
            r'\b(link|url|website|source)s?.*\b(about|for|on|regarding)\b',
        ]
        # Patterns for contextual references
        self.reference_patterns = [
            r'\b(the above|the previous|earlier|before)\b',
            r'\b(that|this|it|these|those)\b(?! (is|are|was|were))',  # Exclude "that is", "this is"
            r'\babout (it|that|this)\b',
        ]
    
    def _resolve_references(self, query: str, conversation_history: List[Dict]) -> str:
        """
        Resolve contextual references in query using conversation history.
        
        Args:
            query: User query potentially containing references
            conversation_history: List of previous messages
            
        Returns:
            Enhanced query with resolved references
        """
        if not conversation_history or len(conversation_history) < 2:
            return query
        
        query_lower = query.lower()
        
        # Check if query contains any references
        has_reference = any(
            re.search(pattern, query_lower, re.IGNORECASE)
            for pattern in self.reference_patterns
        )
        
        if not has_reference:
            return query
        
        # Find the last assistant message to extract topic
        last_assistant_msg = None
        for msg in reversed(conversation_history):
            if msg.get("role") == "assistant":
                last_assistant_msg = msg
                break
        
        if not last_assistant_msg:
            return query
        
        # Extract main topic from last assistant response
        content = last_assistant_msg.get("content", "")
        
        # Simple extraction: get first meaningful noun phrase
        # Look for medical terms (capitalized words or common skin conditions)
        medical_terms = re.findall(
            r'\b([Mm]elanoma|[Bb]asal [Cc]ell|[Ss]quamous [Cc]ell|BCC|SCC|[Aa]ctinic [Kk]eratosis|'
            r'[Ss]kin [Cc]ancer|[Dd]ermatology|[Ll]esion|[Tt]umor|[Cc]arcinoma)\b',
            content[:500]  # Check first 500 chars
        )
        
        if medical_terms:
            topic = medical_terms[0]
            logger.info(f"🔍 Resolved reference in query: '{query}' → topic: '{topic}'")
            
            # Replace reference with topic
            enhanced_query = re.sub(
                r'\b(the above|the previous|that|this|it)\b',
                topic,
                query,
                flags=re.IGNORECASE,
                count=1
            )
            
            return enhanced_query
        
        return query
    
    def route(self, query: str, conversation_history: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Route query to appropriate agent with conversation awareness.
        
        Args:
            query: User query
            conversation_history: Optional list of previous messages for context
            
        Returns:
            Routing decision with agent type and metadata
        """
        # Resolve contextual references if history available
        original_query = query
        if conversation_history:
            query = self._resolve_references(query, conversation_history)
            if query != original_query:
                logger.info(f"Query enhanced: '{original_query}' → '{query}'")
        
        # Check for URLs in query
        urls = re.findall(self.url_pattern, query)
        
        if urls:
            # URL detected → Route to Web Scraping Agent
            logger.info(f"Router: URL detected → Web Scraping Agent")
            return {
                "agent": AgentType.WEB_SCRAPING_AGENT,
                "reason": "URL detected in query",
                "urls": urls,
                "query": query,
                "conversation_history": conversation_history
            }
        
        # Check if user is requesting links/URLs
        query_lower = query.lower()
        is_link_request = any(
            re.search(pattern, query_lower, re.IGNORECASE)
            for pattern in self.link_request_patterns
        )
        
        if is_link_request:
            # User wants links → Route to Web Scraping Agent
            logger.info(f"Router: Link request detected → Web Scraping Agent")
            return {
                "agent": AgentType.WEB_SCRAPING_AGENT,
                "reason": "User requested links/URLs",
                "urls": [],  # No URLs provided, Tavily will search
                "query": query,
                "search_mode": True,  # Flag to indicate we need to search for links
                "conversation_history": conversation_history
            }
        else:
            # No URL → Route to RAG Agent (default)
            logger.info(f"Router: Medical query → RAG Agent")
            return {
                "agent": AgentType.RAG_AGENT,
                "reason": "Medical question without URL",
                "query": query,
                "conversation_history": conversation_history
            }
    
    def get_routing_summary(self, routing_decision: Dict[str, Any]) -> str:
        """
        Get human-readable routing summary.
        
        Args:
            routing_decision: Routing decision
            
        Returns:
            Summary string
        """
        agent = routing_decision["agent"]
        reason = routing_decision["reason"]
        
        if agent == AgentType.WEB_SCRAPING_AGENT:
            urls = routing_decision.get("urls", [])
            return f"Routing to Web Scraping Agent (Tavily MCP) - {len(urls)} URL(s) detected"
        else:
            return "Routing to RAG Agent - Medical Q&A"


# Global router instance
router_agent = RouterAgent()
