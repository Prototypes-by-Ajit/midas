"""Main Orchestrator - Routes queries to specialized agents."""
import logging
from typing import Dict, Any, Optional, List

from app.agents.router_agent import router_agent, AgentType
from app.agents.rag_agent import rag_agent
from app.agents.react_cot_agent import react_cot_agent
from app.agents.web_scraping_agent import web_scraping_agent
from app.services.chat_persistence import chat_persistence

logger = logging.getLogger(__name__)


class MainOrchestrator:
    """
    Main orchestrator using router-based architecture.
    
    Architecture:
    - Router Agent: Classifies query → Routes to appropriate agent
    - ReAct + CoT Agent: Medical Q&A with guaranteed ≥75% confidence (default)
    - RAG Agent: Fallback medical Q&A with vector store
    - Web Scraping Agent: URL extraction via Tavily MCP only
    """
    
    def __init__(self):
        """Initialize orchestrator."""
        self.router = router_agent
        self.rag_agent = rag_agent
        self.react_cot_agent = react_cot_agent
        self.web_agent = web_scraping_agent
    
    async def process_query(
        self,
        query: str,
        session_id: str,
        user_id: Optional[str] = None,
        lesion_class: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Process query through router-based architecture with conversation memory.
        
        Args:
            query: User query
            session_id: Session ID
            user_id: User ID
            lesion_class: Optional lesion class filter
            
        Returns:
            Response from appropriate agent
        """
        # ===== STEP 0: RETRIEVE CONVERSATION HISTORY =====
        conversation_history = await chat_persistence.get_session_messages(
            session_id=session_id,
            limit=5  # Last 5 messages for context
        )
        logger.info(f"📜 Retrieved {len(conversation_history)} messages from history")
        
        # ===== STEP 1: ROUTE QUERY WITH CONTEXT =====
        routing_decision = self.router.route(query, conversation_history=conversation_history)
        agent_type = routing_decision["agent"]
        
        logger.info(f"🔀 {self.router.get_routing_summary(routing_decision)}")
        
        # ===== STEP 2: EXECUTE VIA APPROPRIATE AGENT =====
        if agent_type == AgentType.WEB_SCRAPING_AGENT:
            # Route to Web Scraping Agent (Tavily search or extract)
            response = await self.web_agent.process(
                query=routing_decision["query"],  # Use resolved query
                urls=routing_decision["urls"],
                session_id=session_id,
                search_mode=routing_decision.get("search_mode", False),
                conversation_history=routing_decision.get("conversation_history")
            )
        elif agent_type == AgentType.REACT_COT_AGENT:
            # Route to ReAct + CoT Agent (guaranteed high confidence)
            response = await self.react_cot_agent.process_with_confidence_guarantee(
                query=routing_decision["query"],  # Use resolved query
                lesion_class=lesion_class,
                conversation_history=routing_decision.get("conversation_history")
            )
        else:
            # Route to RAG Agent (fallback)
            response = await self.rag_agent.process(
                query=routing_decision["query"],  # Use resolved query
                session_id=session_id,
                user_id=user_id,
                lesion_class=lesion_class,
                conversation_history=routing_decision.get("conversation_history")
            )
        
        # Add routing metadata
        response["routing"] = {
            "agent_used": agent_type.value,
            "routing_reason": routing_decision["reason"]
        }
        
        return response


# Global orchestrator instance
main_orchestrator = MainOrchestrator()
