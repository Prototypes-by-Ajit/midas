"""Router Agent - Routes queries to appropriate specialized agent with MIDAS guardrails."""
import re
import logging
from typing import Dict, Any, Optional, List
from enum import Enum

from app.utils.prompts import OUT_OF_SCOPE_RESPONSE

logger = logging.getLogger(__name__)


class AgentType(str, Enum):
    """Available agent types."""
    REACT_COT_AGENT = "react_cot_agent"  # ReAct + CoT for guaranteed high confidence
    WEB_SCRAPING_AGENT = "web_scraping_agent"
    OUT_OF_SCOPE = "out_of_scope"  # MIDAS guardrail: non-dermatology queries


class RouterAgent:
    """
    Router agent that classifies queries and routes to appropriate agent.
    
    Routing Logic:
    - Contains URL → Web Scraping Agent (Tavily MCP)
    - Requests links/URLs → Web Scraping Agent (Tavily MCP)
    - Medical question → ReAct + CoT Agent (default)
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
        # MIDAS guardrails: IN-SCOPE dermatology keywords
        # If query has NONE of these AND is not a valid followup → OUT_OF_SCOPE
        self.in_scope_keywords = [
            "skin", "melanoma", "cancer", "lesion", "mole", "dermato",
            "biopsy", "carcinoma", "bcc", "scc", "nevus", "keratosis",
            "abcde", "dermoscopy", "uv", "sunburn", "tumor", "malignant",
            "benign", "pigment", "spot", "rash", "treatment", "diagnosis",
            "dermatologist", "oncology", "metastasis", "staging", "prognosis",
            "excision", "mohs", "immunotherapy", "radiation", "chemotherapy",
            "prevention", "screening", "examination", "symptom", "sign",
            "bleeding", "itching", "growth", "change", "border", "asymmetry",
            "color", "diameter", "evolving", "abcde rule", "ugly duckling",
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
            
            # Replace explicit pronouns first
            enhanced_query = re.sub(
                r'\b(the above|the previous|that|this|it|these|those)\b',
                topic,
                query,
                flags=re.IGNORECASE,
                count=1
            )
            
            # If query still does not mention the topic and looks like a follow‑up (short, generic), prepend topic
            lowered = enhanced_query.lower()
            has_topic = re.search(rf"\b{re.escape(topic.lower())}\b", lowered) is not None
            looks_followup = (len(enhanced_query.split()) <= 8) or re.search(r"treat|risk|cause|symptom|manage|therapy|prognosis", lowered)
            if not has_topic and looks_followup:
                enhanced_query = f"{topic}: {enhanced_query}".strip()
            
            return enhanced_query
        
        return query
    
    def _has_dermatology_context(self, conversation_history: List[Dict]) -> bool:
        """
        Check if conversation history contains dermatology/skin cancer context.

        Args:
            conversation_history: List of previous messages

        Returns:
            True if conversation has dermatology context
        """
        if not conversation_history:
            return False

        # Check last few messages for in-scope keywords
        for msg in conversation_history[-5:]:  # Check last 5 messages
            content = (msg.get("content") or "").lower()
            if any(kw in content for kw in self.in_scope_keywords):
                return True
        return False

    def _is_followup_query(self, query: str) -> bool:
        """
        Check if query is a followup/referential question.

        Args:
            query: User query

        Returns:
            True if query appears to be a followup
        """
        query_lower = query.lower()
        followup_patterns = [
            "tell me more", "more about", "what about", "how about",
            "the above", "above", "that", "this", "it",
            "continue", "go on", "explain further", "elaborate",
            "and what", "also", "additionally", "furthermore"
        ]
        # Short queries with followup patterns are likely followups
        is_short = len(query.split()) <= 10
        has_followup_pattern = any(p in query_lower for p in followup_patterns)
        return is_short and has_followup_pattern

    def route(self, query: str, conversation_history: Optional[List[Dict]] = None) -> Dict[str, Any]:
        """
        Route query to appropriate agent with MIDAS guardrails and conversation awareness.

        Args:
            query: User query
            conversation_history: Optional list of previous messages for context

        Returns:
            Routing decision with agent type and metadata
        """
        query_lower = query.lower()

        # ===== MIDAS GUARDRAILS: SMART SCOPE CHECK =====
        # Check if query contains ANY in-scope dermatology keywords
        has_in_scope_keywords = any(kw in query_lower for kw in self.in_scope_keywords)

        # Check if this is a followup question
        is_followup = self._is_followup_query(query)

        # Check if conversation has dermatology context
        has_derm_context = self._has_dermatology_context(conversation_history)

        # DECISION: Query is IN-SCOPE if:
        # 1. It contains in-scope keywords, OR
        # 2. It's a followup AND conversation has dermatology context
        is_in_scope = has_in_scope_keywords or (is_followup and has_derm_context)

        if not is_in_scope:
            # OUT_OF_SCOPE: No dermatology keywords and not a valid followup
            logger.info(f"Router: OUT_OF_SCOPE - no dermatology keywords, not a valid followup")
            return {
                "agent": AgentType.OUT_OF_SCOPE,
                "reason": "Query is not related to dermatology/skin cancer",
                "query": query,
                "out_of_scope_response": OUT_OF_SCOPE_RESPONSE,
                "conversation_history": conversation_history
            }

        # ===== RESOLVE REFERENCES FOR FOLLOWUPS =====
        original_query = query
        if conversation_history and is_followup:
            query = self._resolve_references(query, conversation_history)
            if query != original_query:
                logger.info(f"Query enhanced: '{original_query}' → '{query}'")

        # ===== URL/LINK ROUTING =====
        urls = re.findall(self.url_pattern, query)

        if urls:
            logger.info(f"Router: URL detected → Web Scraping Agent")
            return {
                "agent": AgentType.WEB_SCRAPING_AGENT,
                "reason": "URL detected in query",
                "urls": urls,
                "query": query,
                "conversation_history": conversation_history
            }

        is_link_request = any(
            re.search(pattern, query_lower, re.IGNORECASE)
            for pattern in self.link_request_patterns
        )

        if is_link_request:
            logger.info(f"Router: Link request detected → Web Scraping Agent")
            return {
                "agent": AgentType.WEB_SCRAPING_AGENT,
                "reason": "User requested links/URLs",
                "urls": [],
                "query": query,
                "search_mode": True,
                "conversation_history": conversation_history
            }

        # ===== DEFAULT: MEDICAL Q&A =====
        logger.info(f"Router: IN_SCOPE medical query → ReAct + CoT Agent")
        return {
            "agent": AgentType.REACT_COT_AGENT,
            "reason": "Dermatology question requiring high confidence (≥75%)",
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

        if agent == AgentType.OUT_OF_SCOPE:
            return "🚫 OUT_OF_SCOPE - Query not related to dermatology/skin cancer"
        elif agent == AgentType.WEB_SCRAPING_AGENT:
            urls = routing_decision.get("urls", [])
            return f"Routing to Web Scraping Agent (Tavily MCP) - {len(urls)} URL(s) detected"
        else:
            return "Routing to ReAct + CoT Agent - Medical Q&A with ≥75% Confidence Guarantee"


# Global router instance
router_agent = RouterAgent()
