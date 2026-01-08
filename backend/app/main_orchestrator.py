"""Main Orchestrator - Routes queries to specialized agents."""
import logging
from typing import Dict, Any, Optional

from app.agents.router_agent import router_agent, AgentType
from app.agents.rag_agent import rag_agent
from app.agents.web_scraping_agent import web_scraping_agent

logger = logging.getLogger(__name__)


class MainOrchestrator:
    """
    Main orchestrator using router-based architecture.
    
    Architecture:
    - Router Agent: Classifies query → Routes to appropriate agent
    - RAG Agent: Default medical Q&A with vector store
    - Web Scraping Agent: URL extraction via Tavily MCP only
    """
    
    def __init__(self):
        """Initialize orchestrator."""
        self.router = router_agent
        self.rag_agent = rag_agent
        self.web_agent = web_scraping_agent
    
    async def process_query(
        self,
        query: str,
        session_id: str,
        user_id: Optional[str] = None,
        lesion_class: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process query through router-based architecture.
        
        Args:
            query: User query
            session_id: Session ID
            user_id: User ID
            lesion_class: Optional lesion class filter
            
        Returns:
            Response from appropriate agent
        """
        # ===== STEP 1: ROUTE QUERY =====
        routing_decision = self.router.route(query)
        agent_type = routing_decision["agent"]
        
        logger.info(f"🔀 {self.router.get_routing_summary(routing_decision)}")
        
        # ===== STEP 2: EXECUTE VIA APPROPRIATE AGENT =====
        if agent_type == AgentType.WEB_SCRAPING_AGENT:
            # Route to Web Scraping Agent (Tavily MCP)
            response = await self.web_agent.process(
                query=query,
                urls=routing_decision["urls"],
                session_id=session_id
            )
        else:
            # Route to RAG Agent (default)
            response = await self.rag_agent.process(
                query=query,
                session_id=session_id,
                user_id=user_id,
                lesion_class=lesion_class
            )
        
        # Add routing metadata
        response["routing"] = {
            "agent_used": agent_type.value,
            "routing_reason": routing_decision["reason"]
        }
        
        return response


# Global orchestrator instance
main_orchestrator = MainOrchestrator()
