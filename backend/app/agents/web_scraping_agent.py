"""Web Scraping Agent - Uses Tavily MCP to extract content from URLs."""
import logging
import time
from typing import Dict, Any, Optional, List
from groq import Groq

from app.config import settings, MEDICAL_DISCLAIMER
from app.services.tavily_service import tavily_service

logger = logging.getLogger(__name__)


class WebScrapingAgent:
    """
    Web Scraping Agent using Tavily MCP.
    
    Pipeline:
    1. Extract URL from query
    2. Use Tavily MCP to fetch content
    3. LLM summarization with strict citation
    4. Return web-grounded response
    """
    
    def __init__(self):
        """Initialize web scraping agent."""
        self.groq_client = None
        if settings.groq_api_key:
            self.groq_client = Groq(api_key=settings.groq_api_key)
    
    async def process(
        self,
        query: str,
        urls: List[str],
        session_id: str
    ) -> Dict[str, Any]:
        """
        Process query with URL extraction via Tavily MCP.
        
        Args:
            query: User query with URL
            urls: List of URLs detected
            session_id: Session ID
            
        Returns:
            Web-grounded response with citations
        """
        start_time = time.time()
        
        try:
            # ===== STEP 1: TAVILY MCP EXTRACTION =====
            if not tavily_service.is_configured():
                return {
                    "answer": (
                        "Web scraping is currently unavailable (Tavily MCP not configured). "
                        "Please ask your question directly without a URL."
                    ),
                    "citations": [],
                    "confidence": 0.0,
                    "route": "error",
                    "session_id": session_id,
                    "model_used": "error",
                    "mode": "web_scraping_agent"
                }
            
            url = urls[0]  # Use first URL
            logger.info(f"Web Scraping Agent: Extracting {url} via Tavily MCP")
            
            # Extract content using Tavily MCP
            tavily_result = await tavily_service.extract_context(query, [url])
            
            if not tavily_result.get("success") or not tavily_result.get("results"):
                return {
                    "answer": (
                        f"Unable to extract content from {url}. "
                        "The URL may not be accessible or may not contain relevant skin cancer information. "
                        "Please provide a different URL or ask your question directly."
                    ),
                    "citations": [],
                    "confidence": 0.0,
                    "route": "error",
                    "session_id": session_id,
                    "model_used": "tavily_mcp",
                    "mode": "web_scraping_agent",
                    "source_confidence": {
                        "has_web_sources": False,
                        "source_type": "tavily_extract_failed",
                        "url": url,
                        "confidence": "none"
                    }
                }
            
            # ===== STEP 2: PARSE EXTRACTED CONTENT =====
            result = tavily_result["results"][0]
            web_content = {
                "url": url,
                "title": result.get("title", "Web Content"),
                "content": result.get("content", result.get("raw_content", "")),
                "domain": url.split("/")[2] if "/" in url else url
            }
            
            logger.info(f"Tavily MCP extracted {len(web_content['content'])} chars")
            
            # ===== STEP 3: LLM GENERATION WITH STRICT CITATION =====
            if not self.groq_client:
                raise RuntimeError("Groq client not initialized")
            
            # System prompt
            system_prompt = (
                "You are MIDAS AI Web Scraping Agent, specialized in summarizing web content about skin cancer.\\n\\n"
                "CRITICAL RULES:\\n"
                "1. ONLY use information from the provided web content\\n"
                "2. Extract and cite specific text chunks\\n"
                "3. NEVER add information beyond what's in the source\\n"
                "4. If the content doesn't answer the question, explicitly state that\\n"
                "5. Always cite the source URL"
            )
            
            # User prompt
            user_prompt = f"""Web content extracted from {url}:

Title: {web_content['title']}
Content:
{web_content['content']}

User Question: {query}

Summarize the relevant information from this web page that answers the user's question. 
Use ONLY the information provided above. Cite specific passages."""
            
            # Call Groq
            chat_completion = self.groq_client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                model=settings.groq_model,
                temperature=0.1,  # Lower temperature for factual extraction
                max_tokens=settings.groq_max_tokens
            )
            
            answer = chat_completion.choices[0].message.content
            
            # Add disclaimer and source
            answer += f"\\n\\n**Source:** {url}"
            answer += MEDICAL_DISCLAIMER
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            # ===== STEP 4: CREATE CITATIONS =====
            citations = [{
                "source": f"Web: {web_content['title']}",
                "content": web_content['content'][:500] + "...",
                "relevance_score": 1.0,
                "url": url,
                "domain": web_content['domain'],
                "source_type": "tavily_extract"
            }]
            
            return {
                "answer": answer,
                "citations": citations,
                "confidence": 0.85,  # High confidence for direct web extraction
                "confidence_breakdown": {
                    "source_quality": 1.0,
                    "extraction_success": True
                },
                "route": "answer",
                "session_id": session_id,
                "model_used": f"{settings.groq_model} + Tavily MCP",
                "mode": "web_scraping_agent",
                "latency_ms": latency_ms,
                "source_confidence": {
                    "has_web_sources": True,
                    "source_type": "tavily_extract",
                    "url": url,
                    "confidence": "high"
                }
            }
            
        except Exception as e:
            logger.error(f"Web Scraping Agent error: {e}")
            return {
                "answer": f"Error extracting web content: {str(e)}{MEDICAL_DISCLAIMER}",
                "citations": [],
                "confidence": 0.0,
                "route": "error",
                "session_id": session_id,
                "model_used": "error",
                "mode": "web_scraping_agent"
            }


# Global web scraping agent instance
web_scraping_agent = WebScrapingAgent()
