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
    
    async def _search_for_links(
        self,
        query: str,
        session_id: str,
        start_time: float
    ) -> Dict[str, Any]:
        """
        Search for relevant medical links using Tavily.
        
        Args:
            query: User query requesting links
            session_id: Session ID
            start_time: Start time for latency tracking
            
        Returns:
            Response with top 10 links
        """
        try:
            # Search for medical links using Tavily
            search_result = await tavily_service.search_medical(
                query=query,
                max_results=10  # Get top 10 links
            )
            
            if not search_result.get("success") or not search_result.get("results"):
                return {
                    "answer": (
                        f"I couldn't find relevant medical links for '{query}'. "
                        "Please try rephrasing your question or ask directly without requesting links."
                    ),
                    "citations": [],
                    "confidence": 0.0,
                    "route": "error",
                    "session_id": session_id,
                    "model_used": "tavily_search",
                    "mode": "web_scraping_agent_search"
                }
            
            # Format the links as a response
            results = search_result["results"]
            answer_parts = [
                f"Here are the top {len(results)} medical resources about {query}:\n"
            ]
            
            for idx, result in enumerate(results, 1):
                title = result.get("title", "Untitled")
                url = result.get("url", "")
                content_snippet = result.get("content", "")[:150]
                
                answer_parts.append(
                    f"**{idx}. {title}**\n"
                    f"🔗 {url}\n"
                    f"📝 {content_snippet}...\n"
                )
            
            answer = "\n".join(answer_parts)
            answer += MEDICAL_DISCLAIMER
            
            # Create citations from search results
            citations = [
                {
                    "source": f"Web: {r.get('title', 'Untitled')}",
                    "content": r.get("content", "")[:300],
                    "relevance_score": r.get("score", 0.8),
                    "url": r.get("url", ""),
                    "domain": r.get("url", "").split("/")[2] if "/" in r.get("url", "") else "",
                    "source_type": "tavily_search"
                }
                for r in results
            ]
            
            latency_ms = int((time.time() - start_time) * 1000)
            
            return {
                "answer": answer,
                "citations": citations,
                "confidence": 0.90,  # High confidence for link search results
                "confidence_breakdown": {
                    "source_quality": 0.95,
                    "search_success": True,
                    "result_count": len(results)
                },
                "route": "answer",
                "session_id": session_id,
                "model_used": "Tavily Medical Search",
                "mode": "web_scraping_agent_search",
                "latency_ms": latency_ms,
                "source_confidence": {
                    "has_web_sources": True,
                    "source_type": "tavily_search",
                    "result_count": len(results),
                    "confidence": "high"
                }
            }
            
        except Exception as e:
            logger.error(f"Link search error: {e}")
            return {
                "answer": f"Error searching for links: {str(e)}{MEDICAL_DISCLAIMER}",
                "citations": [],
                "confidence": 0.0,
                "route": "error",
                "session_id": session_id,
                "model_used": "error",
                "mode": "web_scraping_agent_search"
            }
    
    async def process(
        self,
        query: str,
        urls: List[str],
        session_id: str,
        search_mode: bool = False,
        conversation_history: Optional[List[Dict]] = None
    ) -> Dict[str, Any]:
        """
        Process query with URL extraction or link search via Tavily.
        
        Args:
            query: User query
            urls: List of URLs detected (empty if search_mode=True)
            session_id: Session ID
            search_mode: If True, search for links instead of extracting
            
        Returns:
            Web-grounded response with citations or list of links
        """
        start_time = time.time()
        
        try:
            # ===== CHECK TAVILY CONFIGURATION =====
            if not tavily_service.is_configured():
                return {
                    "answer": (
                        "Web search is currently unavailable (Tavily not configured). "
                        "Please ask your question directly."
                    ),
                    "citations": [],
                    "confidence": 0.0,
                    "route": "error",
                    "session_id": session_id,
                    "model_used": "error",
                    "mode": "web_scraping_agent"
                }
            
            # ===== SEARCH MODE: FIND LINKS =====
            if search_mode or not urls:
                logger.info(f"Web Scraping Agent: Searching for links about '{query}'")
                return await self._search_for_links(query, session_id, start_time)
            
            # ===== EXTRACT MODE: EXTRACT FROM URL =====
            url = urls[0]  # Use first URL
            logger.info(f"Web Scraping Agent: Extracting {url} via Tavily")
            
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
