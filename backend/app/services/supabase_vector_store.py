"""Supabase vector store with pgvector for semantic search."""
import asyncio
from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import numpy as np
from app.config import settings
from app.services.embeddings import embedding_service
from app.indexing.rag_chunk_index import rag_chunk_index
import logging

logger = logging.getLogger(__name__)


@dataclass
class SearchResult:
    """Search result from vector store."""
    document_id: str
    chunk_text: str
    similarity: float
    title: Optional[str]
    source: Optional[str]
    lesion_class: Optional[str]
    metadata: Dict[str, Any]


class SupabaseVectorStore:
    """
    Vector store using Supabase pgvector extension.
    
    Features:
    - Cloud-based vector storage
    - Semantic search with pgvector
    - Direct PostgreSQL connection
    - Built-in RLS and auth
    """
    
    def __init__(self):
        """Initialize Supabase vector store."""
        self.client = None
        self.is_initialized = False
        self.bplus_index = rag_chunk_index  # B+ tree for efficient chunk indexing
        
    def initialize(self):
        """Initialize Supabase client."""
        if not settings.supabase_url or not settings.supabase_service_key:
            logger.warning("Supabase credentials not configured")
            return False
            
        try:
            from supabase import create_client

            self.client = create_client(
                settings.supabase_url,
                settings.supabase_service_key  # Use service key for admin operations
            )
            self.is_initialized = True
            logger.info("✅ Supabase vector store initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize Supabase: {e}")
            return False
    
    async def add_document(
        self,
        title: str,
        content: str,
        source: str,
        source_type: str = "guideline",
        lesion_class: Optional[str] = None,
        tags: Optional[List[str]] = None,
        metadata: Optional[Dict[str, Any]] = None,
        chunk_size: int = 500
    ) -> str:
        """
        Add a document to the vector store with embeddings.
        
        Args:
            title: Document title
            content: Full document content
            source: Source identifier
            source_type: Type of source (guideline, research, faq)
            lesion_class: Lesion class (MEL, NV, BCC, etc.)
            tags: List of tags
            metadata: Additional metadata
            chunk_size: Size of text chunks for embeddings
            
        Returns:
            Document ID
        """
        if not self.is_initialized:
            raise RuntimeError("Vector store not initialized")
        
        try:
            # 1. Insert document
            doc_data = {
                "title": title,
                "content": content,
                "source": source,
                "source_type": source_type,
                "lesion_class": lesion_class,
                "tags": tags or [],
                "metadata": metadata or {}
            }
            
            result = self.client.table("documents").insert(doc_data).execute()
            document_id = result.data[0]["id"]
            logger.info(f"Inserted document: {document_id}")
            
            # 2. Chunk the content
            chunks = self._chunk_text(content, chunk_size)
            
            # 3. Index in B+ tree for fast neighbor retrieval
            self.bplus_index.index_document(
                tenant_id="default",
                doc_id=document_id,
                text=content,
                chunk_size=chunk_size,
                overlap=100,  # 100 char overlap for context continuity
                lesion_class=lesion_class,
                source=source
            )
            logger.info(f"Indexed document in B+ tree: {document_id}")
            
            # 4. Generate embeddings for each chunk
            embedding_records = []
            for i, chunk in enumerate(chunks):
                # Generate embedding
                embedding_vector = embedding_service.embed_text(chunk)
                
                embedding_records.append({
                    "document_id": document_id,
                    "embedding": embedding_vector.tolist(),  # pgvector accepts lists
                    "chunk_text": chunk,
                    "chunk_index": i,
                    "chunk_size": len(chunk),
                    "model_version": settings.embedding_model_version
                })
            
            # 4. Batch insert embeddings
            if embedding_records:
                self.client.table("embeddings").insert(embedding_records).execute()
                logger.info(f"Inserted {len(embedding_records)} embeddings for document {document_id}")
            
            return document_id
            
        except Exception as e:
            logger.error(f"Error adding document: {e}")
            raise
    
    async def search(
        self,
        query: str,
        top_k: int = 10,
        match_threshold: float = 0.5,
        lesion_class: Optional[str] = None
    ) -> List[SearchResult]:
        """
        Search for similar documents using vector similarity.
        
        Args:
            query: Search query
            top_k: Number of results to return
            match_threshold: Minimum similarity threshold (0-1)
            lesion_class: Filter by lesion class
            
        Returns:
            List of search results
        """
        if not self.is_initialized:
            raise RuntimeError("Vector store not initialized")
        
        try:
            # 1. Generate query embedding
            query_embedding = embedding_service.embed_text(query)
            
            # 2. Try using match_documents_simple RPC function (no schema issues)
            try:
                result = self.client.rpc(
                    "match_documents_simple",
                    {
                        "query_embedding": query_embedding.tolist(),
                        "match_threshold": match_threshold,
                        "match_count": top_k
                    }
                ).execute()
                
                # 3. Parse results from simple match function
                search_results = []
                for row in result.data:
                    # Get document info
                    doc_result = self.client.table("documents")\
                        .select("title, source, lesion_class")\
                        .eq("id", row["document_id"])\
                        .single()\
                        .execute()
                    
                    doc_data = doc_result.data if doc_result.data else {}
                    
                    search_results.append(SearchResult(
                        document_id=row["document_id"],
                        chunk_text=row["chunk_text"],
                        similarity=row["similarity"],
                        title=doc_data.get("title"),
                        source=doc_data.get("source"),
                        lesion_class=doc_data.get("lesion_class"),
                        metadata={}
                    ))
                
                logger.info(f"Found {len(search_results)} results using match_documents_simple")
                return search_results
                
            except Exception as rpc_error:
                logger.warning(f"RPC match_documents_simple failed: {rpc_error}, using Python fallback")
                
                # FALLBACK: Get all embeddings and calculate similarity in Python
                all_embeddings = self.client.table("embeddings")\
                    .select("id, document_id, chunk_text, embedding")\
                    .execute()
                
                if not all_embeddings.data:
                    logger.warning("No embeddings found in database")
                    return []
                
                # Calculate similarities in Python
                import numpy as np
                query_vec = query_embedding
                
                similarities = []
                for emb_row in all_embeddings.data:
                    # Handle embedding (could be list, string, or already numpy array)
                    emb_data = emb_row["embedding"]
                    if isinstance(emb_data, str):
                        # Parse string representation
                        emb_data = emb_data.strip('[]').split(',')
                        emb_vec = np.array([float(x) for x in emb_data])
                    elif isinstance(emb_data, list):
                        emb_vec = np.array(emb_data, dtype=float)
                    else:
                        emb_vec = np.array(emb_data, dtype=float)
                    
                    # Cosine similarity
                    similarity = np.dot(query_vec, emb_vec) / (np.linalg.norm(query_vec) * np.linalg.norm(emb_vec))
                    
                    if similarity > match_threshold:
                        similarities.append({
                            "document_id": emb_row["document_id"],
                            "chunk_text": emb_row["chunk_text"],
                            "similarity": float(similarity)
                        })
                
                # Sort by similarity and take top_k
                similarities.sort(key=lambda x: x["similarity"], reverse=True)
                top_results = similarities[:top_k]
                
                # Get document info and create SearchResults
                search_results = []
                for result in top_results:
                    doc_result = self.client.table("documents")\
                        .select("title, source, lesion_class")\
                        .eq("id", result["document_id"])\
                        .single()\
                        .execute()
                    
                    doc_data = doc_result.data if doc_result.data else {}
                    
                    search_results.append(SearchResult(
                        document_id=result["document_id"],
                        chunk_text=result["chunk_text"],
                        similarity=result["similarity"],
                        title=doc_data.get("title"),
                        source=doc_data.get("source"),
                        lesion_class=doc_data.get("lesion_class"),
                        metadata={}
                    ))
                
                logger.info(f"Found {len(search_results)} results using Python fallback")
                return search_results
            
            logger.info(f"Found {len(search_results)} results for query: {query[:50]}...")
            return search_results
            
        except Exception as e:
            logger.error(f"Search error: {e}")
            return []
    
    async def bulk_upload(
        self,
        documents: List[Dict[str, Any]],
        chunk_size: int = 500
    ) -> List[str]:
        """
        Bulk upload multiple documents.
        
        Args:
            documents: List of document dicts with title, content, source, etc.
            chunk_size: Size of text chunks
            
        Returns:
            List of document IDs
        """
        document_ids = []
        
        for doc in documents:
            try:
                doc_id = await self.add_document(
                    title=doc.get("title", "Untitled"),
                    content=doc["content"],
                    source=doc.get("source", "Unknown"),
                    source_type=doc.get("source_type", "guideline"),
                    lesion_class=doc.get("lesion_class"),
                    tags=doc.get("tags"),
                    metadata=doc.get("metadata"),
                    chunk_size=chunk_size
                )
                document_ids.append(doc_id)
            except Exception as e:
                logger.error(f"Failed to upload document: {e}")
                continue
        
        logger.info(f"Bulk upload complete: {len(document_ids)}/{len(documents)} documents")
        return document_ids
    
    def _chunk_text(self, text: str, chunk_size: int = 500) -> List[str]:
        """
        Split text into chunks for embedding.
        
        Args:
            text: Text to chunk
            chunk_size: Target chunk size in characters
            
        Returns:
            List of text chunks
        """
        # Simple chunking by sentences
        sentences = text.replace('\n', ' ').split('. ')
        chunks = []
        current_chunk = ""
        
        for sentence in sentences:
            if len(current_chunk) + len(sentence) < chunk_size:
                current_chunk += sentence + ". "
            else:
                if current_chunk:
                    chunks.append(current_chunk.strip())
                current_chunk = sentence + ". "
        
        if current_chunk:
            chunks.append(current_chunk.strip())
        
        return chunks
    
    async def get_document_stats(self) -> Dict[str, Any]:
        """Get statistics about the vector store."""
        if not self.is_initialized:
            return {"error": "Not initialized"}
        
        try:
            # Count documents
            doc_result = self.client.table("documents").select("id", count="exact").execute()
            doc_count = doc_result.count
            
            # Count embeddings
            emb_result = self.client.table("embeddings").select("id", count="exact").execute()
            emb_count = emb_result.count
            
            # Get lesion class distribution
            lesion_result = self.client.table("documents")\
                .select("lesion_class")\
                .execute()
            
            lesion_distribution = {}
            for row in lesion_result.data:
                lesion_class = row.get("lesion_class", "unknown")
                lesion_distribution[lesion_class] = lesion_distribution.get(lesion_class, 0) + 1
            
            return {
                "total_documents": doc_count,
                "total_embeddings": emb_count,
                "lesion_distribution": lesion_distribution,
                "avg_chunks_per_doc": round(emb_count / doc_count, 2) if doc_count > 0 else 0
            }
        except Exception as e:
            logger.error(f"Error getting stats: {e}")
            return {"error": str(e)}
    
    async def delete_document(self, document_id: str):
        """Delete a document and its embeddings."""
        if not self.is_initialized:
            raise RuntimeError("Vector store not initialized")
        
        try:
            # Cascade delete will remove embeddings automatically
            self.client.table("documents").delete().eq("id", document_id).execute()
            logger.info(f"Deleted document: {document_id}")
        except Exception as e:
            logger.error(f"Error deleting document: {e}")
            raise
    
    def is_ready(self) -> bool:
        """Check if vector store is ready."""
        return self.is_initialized and self.client is not None
    
    async def search_with_neighbors(
        self,
        query: str,
        top_k: int = 10,
        match_threshold: float = 0.5,
        lesion_class: Optional[str] = None,
        neighbor_window: int = 2
    ) -> List[SearchResult]:
        """
        Search with automatic neighbor context expansion using B+ tree.
        
        For each matching chunk, retrieves neighbor_window chunks before/after
        to provide richer context for RAG.
        
        Args:
            query: Search query
            top_k: Number of initial results
            match_threshold: Minimum similarity threshold
            lesion_class: Filter by lesion class
            neighbor_window: Number of chunks before/after to include
            
        Returns:
            List of search results with expanded context
        """
        # 1. Get initial search results
        initial_results = await self.search(
            query=query,
            top_k=top_k,
            match_threshold=match_threshold,
            lesion_class=lesion_class
        )
        
        if not initial_results or neighbor_window == 0:
            return initial_results
        
        # 2. Expand each result with neighbors from B+ tree
        expanded_results = []
        for result in initial_results:
            try:
                # Get chunk_index from metadata if available
                chunk_index = result.metadata.get("chunk_index", 0)
                
                # Retrieve neighbors from B+ tree
                neighbors = self.bplus_index.neighbors(
                    tenant_id="default",
                    doc_id=result.document_id,
                    chunk_id=chunk_index,
                    window=neighbor_window
                )
                
                if neighbors:
                    # Combine neighbor texts for expanded context
                    expanded_text = " ".join([n.text for n in neighbors])
                    
                    # Create expanded result
                    expanded_result = SearchResult(
                        document_id=result.document_id,
                        chunk_text=expanded_text,  # Expanded context
                        similarity=result.similarity,
                        title=result.title,
                        source=result.source,
                        lesion_class=result.lesion_class,
                        metadata={
                            **result.metadata,
                            "neighbor_count": len(neighbors),
                            "context_expanded": True
                        }
                    )
                    expanded_results.append(expanded_result)
                else:
                    # No neighbors found, use original
                    expanded_results.append(result)
                    
            except Exception as e:
                logger.warning(f"Failed to expand neighbors for {result.document_id}: {e}")
                expanded_results.append(result)
        
        logger.info(f"Expanded {len(expanded_results)} results with neighbor context")
        return expanded_results
    
    async def get_chunk_neighbors(
        self,
        document_id: str,
        chunk_id: int,
        window: int = 2
    ) -> List[str]:
        """
        Get neighboring chunks for a specific chunk using B+ tree.
        
        Args:
            document_id: Document ID
            chunk_id: Chunk ID
            window: Number of chunks before/after
            
        Returns:
            List of neighbor chunk texts
        """
        try:
            neighbors = self.bplus_index.neighbors(
                tenant_id="default",
                doc_id=document_id,
                chunk_id=chunk_id,
                window=window
            )
            return [n.text for n in neighbors]
        except Exception as e:
            logger.error(f"Error getting neighbors: {e}")
            return []
    
    async def _store_embedding(
        self,
        document_id: str,
        chunk_text: str,
        chunk_index: int,
        embedding: np.ndarray,
        chunk_size: int
    ) -> None:
        """
        Store a single embedding in the database.
        
        Args:
            document_id: Document ID
            chunk_text: Chunk text content
            chunk_index: Index of chunk in document
            embedding: Embedding vector
            chunk_size: Size of chunk in characters
        """
        if not self.is_initialized:
            raise RuntimeError("Vector store not initialized")
        
        embedding_record = {
            "document_id": document_id,
            "embedding": embedding.tolist(),
            "chunk_text": chunk_text,
            "chunk_index": chunk_index,
            "chunk_size": chunk_size,
            "model_version": settings.embedding_model_version
        }
        
        self.client.table("embeddings").insert(embedding_record).execute()


# Global instance
supabase_vector_store = SupabaseVectorStore()


def get_supabase_client():
    """
    Get the Supabase client from the global vector store.
    Initializes the store if not already initialized.

    Returns:
        Supabase client or None if initialization fails
    """
    if not supabase_vector_store.is_initialized:
        supabase_vector_store.initialize()
    return supabase_vector_store.client


# Backward-compatible name for modules that import it directly. The actual
# client is created lazily by get_supabase_client().
supabase_client = None
