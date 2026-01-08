"""Tavily AI Search service for web-grounded RAG."""
import logging
from typing import List, Dict, Any, Optional
import httpx
import os

logger = logging.getLogger(__name__)


class TavilySearchService:
    """
    Tavily AI-powered search service for medical information.
    
    Features:
    - AI-optimized search for RAG
    - Answer extraction from search results
    - Medical domain filtering
    - Source citations with relevance scores
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize Tavily service.
        
        Args:
            api_key: Tavily API key (or load from env)
        """
        self.api_key = api_key or os.getenv("TAVILY_API_KEY")
        self.base_url = "https://api.tavily.com"
        self.client = httpx.AsyncClient(timeout=30.0)
        
        if not self.api_key:
            logger.warning("Tavily API key not configured")
    
    def is_configured(self) -> bool:
        """Check if Tavily is properly configured."""
        return bool(self.api_key)
    
    async def search(
        self,
        query: str,
        search_depth: str = "advanced",
        max_results: int = 5,
        include_domains: Optional[List[str]] = None,
        exclude_domains: Optional[List[str]] = None,
        include_answer: bool = True,
        include_raw_content: bool = False
    ) -> Dict[str, Any]:
        """
        Perform AI-optimized search via Tavily.
        
        Args:
            query: Search query
            search_depth: "basic" or "advanced" (advanced = more comprehensive)
            max_results: Number of results to return (1-10)
            include_domains: Whitelist of domains to include
            exclude_domains: Blacklist of domains to exclude
            include_answer: Whether to include AI-generated answer
            include_raw_content: Include full page content (slower)
            
        Returns:
            Search results with answer and sources
        """
        if not self.is_configured():
            return {
                "success": False,
                "error": "Tavily API key not configured",
                "query": query
            }
        
        try:
            # Prepare request payload
            payload = {
                "api_key": self.api_key,
                "query": query,
                "search_depth": search_depth,
                "max_results": max_results,
                "include_answer": include_answer,
                "include_raw_content": include_raw_content,
                "include_images": False  # Not needed for medical text
            }
            
            # Add domain filters if provided
            if include_domains:
                payload["include_domains"] = include_domains
            if exclude_domains:
                payload["exclude_domains"] = exclude_domains
            
            logger.info(f"Tavily search: {query} (depth: {search_depth})")
            
            # Make API request
            response = await self.client.post(
                f"{self.base_url}/search",
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            # Parse results
            return {
                "success": True,
                "query": query,
                "answer": result.get("answer"),
                "results": result.get("results", []),
                "result_count": len(result.get("results", [])),
                "search_depth": search_depth
            }
            
        except httpx.HTTPError as e:
            logger.error(f"Tavily HTTP error: {e}")
            return {
                "success": False,
                "error": f"HTTP error: {str(e)}",
                "query": query
            }
        except Exception as e:
            logger.error(f"Tavily search error: {e}")
            return {
                "success": False,
                "error": str(e),
                "query": query
            }
    
    async def search_medical(
        self,
        query: str,
        max_results: int = 5
    ) -> Dict[str, Any]:
        """
        Search specifically for medical/skin cancer information.
        
        Args:
            query: Medical query
            max_results: Number of results
            
        Returns:
            Search results filtered for medical content
        """
        # Trusted medical domains for skin cancer
        medical_domains = [
            "cancer.org",
            "cancer.gov",
            "mayoclinic.org",
            "aad.org",
            "skincancer.org",
            "cancerstaging.org",
            "nih.gov",
            "ncbi.nlm.nih.gov",
            "dermnetnz.org",
            "melanoma.org.au",
            "who.int",
            "nhs.uk"
        ]
        
        # Enhance query with medical context
        enhanced_query = f"{query} dermatology skin cancer medical"
        
        return await self.search(
            query=enhanced_query,
            search_depth="advanced",
            max_results=max_results,
            include_domains=medical_domains,
            include_answer=True,
            include_raw_content=False
        )
    
    async def extract_context(
        self,
        query: str,
        urls: List[str]
    ) -> Dict[str, Any]:
        """
        Extract relevant context from specific URLs.
        
        Args:
            query: Context query
            urls: List of URLs to extract from
            
        Returns:
            Extracted content from URLs
        """
        if not self.is_configured():
            return {
                "success": False,
                "error": "Tavily API key not configured"
            }
        
        try:
            payload = {
                "api_key": self.api_key,
                "urls": urls,
                "query": query
            }
            
            response = await self.client.post(
                f"{self.base_url}/extract",
                json=payload
            )
            response.raise_for_status()
            result = response.json()
            
            return {
                "success": True,
                "query": query,
                "results": result.get("results", []),
                "failed_results": result.get("failed_results", [])
            }
            
        except Exception as e:
            logger.error(f"Tavily extract error: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    def format_for_rag(
        self,
        search_result: Dict[str, Any],
        max_sources: int = 5
    ) -> Dict[str, Any]:
        """
        Format Tavily results for RAG pipeline.
        
        Args:
            search_result: Raw Tavily search result
            max_sources: Maximum number of sources to include
            
        Returns:
            Formatted context for LLM
        """
        if not search_result.get("success"):
            return {
                "context": None,
                "sources": [],
                "error": search_result.get("error")
            }
        
        # Extract answer if available
        answer = search_result.get("answer")
        
        # Format sources
        sources = []
        for idx, result in enumerate(search_result.get("results", [])[:max_sources]):
            sources.append({
                "title": result.get("title"),
                "url": result.get("url"),
                "content": result.get("content"),
                "score": result.get("score", 0),
                "position": idx + 1
            })
        
        # Build context string
        context_parts = []
        
        if answer:
            context_parts.append(f"[Tavily AI Answer]\n{answer}\n")
        
        for source in sources:
            context_parts.append(
                f"[Source {source['position']}: {source['title']}]\n"
                f"URL: {source['url']}\n"
                f"Content: {source['content']}\n"
            )
        
        return {
            "context": "\n\n".join(context_parts) if context_parts else None,
            "sources": sources,
            "answer": answer,
            "source_count": len(sources)
        }
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Global Tavily service instance
tavily_service = TavilySearchService()
