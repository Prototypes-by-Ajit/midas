"""RAG trace logging for observability."""
from typing import List, Dict, Any, Optional
from datetime import datetime
import logging
import uuid

logger = logging.getLogger(__name__)


class RAGTraceLogger:
    """
    Log complete RAG execution traces for observability.
    
    Stores traces with:
    - Query and route
    - Retrieved chunks and scores
    - Reranking results
    - Context relevancy metrics
    - Grounding verification
    - Citations
    - Cache hits
    - Latency breakdown
    """
    
    def __init__(self):
        """Initialize trace logger."""
        self.traces = []  # In-memory storage (use DB in production)
    
    def create_trace(
        self,
        query: str,
        route: str,
        retrieved_chunks: Optional[List[Dict[str, Any]]] = None,
        grounding_passed: Optional[bool] = None,
        grounding_score: Optional[float] = None,
        citations: Optional[List[Dict[str, Any]]] = None,
        cache_hits: Optional[Dict[str, bool]] = None,
        latency_ms: Optional[Dict[str, int]] = None,
        response: Optional[str] = None,
        metadata: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Create a RAG trace.
        
        Args:
            query: User query
            route: Routing decision (answer, clarify, refuse)
            retrieved_chunks: Retrieved document chunks
            grounding_passed: Whether grounding verification passed
            grounding_score: Grounding confidence score
            citations: Citations used in response
            cache_hits: Cache hit indicators per layer
            latency_ms: Latency breakdown in milliseconds
            response: Generated response
            metadata: Additional metadata
            
        Returns:
            Trace ID
        """
        trace_id = str(uuid.uuid4())
        
        # Calculate metrics
        retrieved_chunk_ids = []
        retrieval_scores = []
        context_relevancy_mean = 0.0
        context_relevancy_top1 = 0.0
        context_relevancy_min = 1.0
        source_diversity = 0
        
        if retrieved_chunks:
            retrieved_chunk_ids = [c.get("id", "") for c in retrieved_chunks]
            retrieval_scores = [c.get("score", 0.0) for c in retrieved_chunks]
            
            if retrieval_scores:
                context_relevancy_mean = sum(retrieval_scores) / len(retrieval_scores)
                context_relevancy_top1 = max(retrieval_scores)
                context_relevancy_min = min(retrieval_scores)
            
            # Source diversity
            sources = set(c.get("source", "Unknown") for c in retrieved_chunks)
            source_diversity = len(sources)
        
        trace = {
            "trace_id": trace_id,
            "timestamp": datetime.utcnow().isoformat(),
            "query": query,
            "route": route,
            
            # Retrieval
            "retrieved_chunk_ids": retrieved_chunk_ids,
            "retrieval_scores": retrieval_scores,
            "retrieval_method": "vector",  # or hybrid
            
            # Context relevancy
            "context_relevancy_mean": context_relevancy_mean,
            "context_relevancy_top1": context_relevancy_top1,
            "context_relevancy_min": context_relevancy_min,
            "source_diversity": source_diversity,
            
            # Grounding
            "grounding_passed": grounding_passed,
            "grounding_score": grounding_score,
            "hallucination_risk": not grounding_passed if grounding_passed is not None else False,
            
            # Citations
            "citation_count": len(citations) if citations else 0,
            "citations": citations or [],
            
            # Cache hits
            "cache_hits": cache_hits or {},
            
            # Latency
            "latency_ms": latency_ms or {},
            "latency_total_ms": latency_ms.get("total", 0) if latency_ms else 0,
            
            # Response
            "response_length": len(response) if response else 0,
            
            # Metadata
            "metadata": metadata or {}
        }
        
        # Store trace (in-memory for now)
        self.traces.append(trace)
        
        # Keep only last 1000 traces in memory
        if len(self.traces) > 1000:
            self.traces = self.traces[-1000:]
        
        logger.info(f"Created RAG trace {trace_id} for query: {query[:50]}...")
        
        return trace_id
    
    def get_trace(self, trace_id: str) -> Optional[Dict[str, Any]]:
        """
        Get a trace by ID.
        
        Args:
            trace_id: Trace identifier
            
        Returns:
            Trace data or None
        """
        for trace in self.traces:
            if trace["trace_id"] == trace_id:
                return trace
        return None
    
    def get_recent_traces(self, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Get recent traces.
        
        Args:
            limit: Maximum number of traces to return
            
        Returns:
            List of traces
        """
        return self.traces[-limit:]
    
    def get_metrics_summary(self) -> Dict[str, Any]:
        """
        Get aggregate metrics from all traces.
        
        Returns:
            Metrics summary
        """
        if not self.traces:
            return {"total_traces": 0}
        
        total = len(self.traces)
        
        # Route distribution
        routes = {}
        for trace in self.traces:
            route = trace.get("route", "unknown")
            routes[route] = routes.get(route, 0) + 1
        
        # Grounding metrics
        grounding_passed_count = sum(
            1 for t in self.traces 
            if t.get("grounding_passed") is True
        )
        grounding_pass_rate = grounding_passed_count / total if total > 0 else 0
        
        # Average metrics
        avg_relevancy = sum(
            t.get("context_relevancy_mean", 0) for t in self.traces
        ) / total if total > 0 else 0
        
        avg_latency = sum(
            t.get("latency_total_ms", 0) for t in self.traces
        ) / total if total > 0 else 0
        
        # Cache hit rates
        cache_types = ["embedding", "retrieval", "generation"]
        cache_hit_rates = {}
        for cache_type in cache_types:
            hits = sum(
                1 for t in self.traces
                if t.get("cache_hits", {}).get(cache_type, False)
            )
            cache_hit_rates[cache_type] = hits / total if total > 0 else 0
        
        return {
            "total_traces": total,
            "route_distribution": routes,
            "grounding_pass_rate": round(grounding_pass_rate, 3),
            "avg_context_relevancy": round(avg_relevancy, 3),
            "avg_latency_ms": round(avg_latency, 1),
            "cache_hit_rates": {
                k: round(v, 3) for k, v in cache_hit_rates.items()
            }
        }


# Global instance
rag_trace_logger = RAGTraceLogger()
