"""Router Agent - Routes queries to appropriate specialized agent."""
import re
import logging
from typing import Dict, Any, Optional
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
    - Medical question → RAG Agent (default)
    """
    
    def __init__(self):
        """Initialize router agent."""
        self.url_pattern = r'https?://[\S]+'
    
    def route(self, query: str) -> Dict[str, Any]:
        """
        Route query to appropriate agent.
        
        Args:
            query: User query
            
        Returns:
            Routing decision with agent type and metadata
        """
        # Check for URLs in query
        urls = re.findall(self.url_pattern, query)
        
        if urls:
            # URL detected → Route to Web Scraping Agent
            logger.info(f"Router: URL detected → Web Scraping Agent")
            return {
                "agent": AgentType.WEB_SCRAPING_AGENT,
                "reason": "URL detected in query",
                "urls": urls,
                "query": query
            }
        else:
            # No URL → Route to RAG Agent (default)
            logger.info(f"Router: Medical query → RAG Agent")
            return {
                "agent": AgentType.RAG_AGENT,
                "reason": "Medical question without URL",
                "query": query
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
