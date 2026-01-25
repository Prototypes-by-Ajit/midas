"""
RAG Chunk B+ Tree Index for efficient document chunk management.

Features:
- Character-based chunking with overlap
- B+ tree indexing by (tenant_id, doc_id, chunk_id)
- Fast range queries for document chunks
- Neighbor expansion for context windows
- Content hash deduplication
"""

from dataclasses import dataclass
from typing import Dict, Iterable, List, Optional, Tuple
import hashlib
import logging

from app.indexing.bplus_tree import BPlusTree

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class ChunkMeta:
    """
    Metadata for a document chunk.
    
    Attributes:
        tenant_id: Tenant identifier (for multi-tenancy)
        doc_id: Document identifier
        chunk_id: Sequential chunk number within document
        start_char: Starting character position in original document
        end_char: Ending character position in original document
        content_hash: SHA-256 hash of chunk text for deduplication
        text: Actual chunk text content
        lesion_class: Optional medical lesion classification
        source: Optional source file/URL
    """
    tenant_id: str
    doc_id: str
    chunk_id: int
    start_char: int
    end_char: int
    content_hash: str
    text: str
    lesion_class: Optional[str] = None
    source: Optional[str] = None


def stable_hash(text: str) -> str:
    """Generate stable SHA-256 hash of text."""
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def simple_chunk_text(
    text: str, 
    chunk_size: int = 900, 
    overlap: int = 150
) -> List[Tuple[int, int, str]]:
    """
    Character-based chunking with overlap.
    
    Args:
        text: Text to chunk
        chunk_size: Maximum characters per chunk
        overlap: Overlap between consecutive chunks
        
    Returns:
        List of (start_char, end_char, chunk_text) tuples
        
    Raises:
        ValueError: If chunk_size <= 0 or overlap >= chunk_size
    """
    if chunk_size <= 0:
        raise ValueError("chunk_size must be > 0")
    if overlap < 0:
        raise ValueError("overlap must be >= 0")
    if overlap >= chunk_size:
        raise ValueError("overlap must be < chunk_size")

    chunks: List[Tuple[int, int, str]] = []
    n = len(text)
    start = 0
    
    while start < n:
        end = min(n, start + chunk_size)
        chunk = text[start:end]
        chunks.append((start, end, chunk))
        
        if end == n:
            break
            
        start = end - overlap
        
    return chunks


class RagChunkBPlusIndex:
    """
    B+ Tree index for RAG document chunks.
    
    Maintains:
    - B+ tree with composite key: (tenant_id, doc_id, chunk_id) -> ChunkMeta
    - Secondary dict for O(1) direct chunk access
    - Content hash tracking for deduplication
    
    Optimized for:
    - Fast document-level scans
    - Chunk range retrieval
    - Neighbor context expansion
    - Multi-tenant isolation
    """

    def __init__(self, order: int = 64) -> None:
        """
        Initialize B+ tree index.
        
        Args:
            order: B+ tree order (children per node). Use 64-128 for in-memory.
        """
        self.tree: BPlusTree[Tuple[str, str, int], ChunkMeta] = BPlusTree(order=order)
        self.by_id: Dict[Tuple[str, str, int], ChunkMeta] = {}
        self.by_hash: Dict[str, List[ChunkMeta]] = {}  # Deduplication
        logger.info(f"Initialized RagChunkBPlusIndex with order={order}")

    def index_document(
        self,
        tenant_id: str,
        doc_id: str,
        text: str,
        chunk_size: int = 900,
        overlap: int = 150,
        lesion_class: Optional[str] = None,
        source: Optional[str] = None,
    ) -> List[ChunkMeta]:
        """
        Index a document by chunking and inserting into B+ tree.
        
        Args:
            tenant_id: Tenant identifier
            doc_id: Document identifier
            text: Document text content
            chunk_size: Maximum characters per chunk
            overlap: Overlap between chunks
            lesion_class: Optional medical classification
            source: Optional source file/URL
            
        Returns:
            List of ChunkMeta objects created
        """
        metas: List[ChunkMeta] = []
        chunks = simple_chunk_text(text, chunk_size=chunk_size, overlap=overlap)
        
        logger.info(f"Indexing document {doc_id}: {len(chunks)} chunks")
        
        for chunk_id, (s, e, chunk_text) in enumerate(chunks):
            content_hash = stable_hash(chunk_text)
            
            meta = ChunkMeta(
                tenant_id=tenant_id,
                doc_id=doc_id,
                chunk_id=chunk_id,
                start_char=s,
                end_char=e,
                content_hash=content_hash,
                text=chunk_text,
                lesion_class=lesion_class,
                source=source,
            )
            
            # Insert into B+ tree
            key = (tenant_id, doc_id, chunk_id)
            self.tree.insert(key, meta)
            
            # Cache in secondary indices
            self.by_id[key] = meta
            
            if content_hash not in self.by_hash:
                self.by_hash[content_hash] = []
            self.by_hash[content_hash].append(meta)
            
            metas.append(meta)
            
        logger.info(f"Indexed {len(metas)} chunks for document {doc_id}")
        return metas

    def get_chunk(
        self, 
        tenant_id: str, 
        doc_id: str, 
        chunk_id: int
    ) -> Optional[ChunkMeta]:
        """
        Get a specific chunk by exact coordinates.
        
        Args:
            tenant_id: Tenant ID
            doc_id: Document ID
            chunk_id: Chunk ID
            
        Returns:
            ChunkMeta if found, None otherwise
        """
        return self.by_id.get((tenant_id, doc_id, chunk_id))

    def get_doc_chunks(
        self, 
        tenant_id: str, 
        doc_id: str
    ) -> List[ChunkMeta]:
        """
        Get all chunks for a document via B+ tree range query.
        
        Args:
            tenant_id: Tenant ID
            doc_id: Document ID
            
        Returns:
            List of all chunks in document (ordered by chunk_id)
        """
        low = (tenant_id, doc_id, 0)
        high = (tenant_id, doc_id, 10**18)  # Sentinel high value
        return self.tree.range_query(low, high)

    def get_chunk_range(
        self, 
        tenant_id: str, 
        doc_id: str, 
        start_chunk_id: int, 
        end_chunk_id: int
    ) -> List[ChunkMeta]:
        """
        Get a range of chunks from a document.
        
        Useful for:
        - Pagination
        - Sequential processing
        - Context windows
        
        Args:
            tenant_id: Tenant ID
            doc_id: Document ID
            start_chunk_id: Start chunk (inclusive)
            end_chunk_id: End chunk (inclusive)
            
        Returns:
            List of chunks in range
        """
        low = (tenant_id, doc_id, start_chunk_id)
        high = (tenant_id, doc_id, end_chunk_id)
        return self.tree.range_query(low, high)

    def neighbors(
        self, 
        tenant_id: str, 
        doc_id: str, 
        chunk_id: int, 
        window: int = 2
    ) -> List[ChunkMeta]:
        """
        Get neighboring chunks for context expansion.
        
        Critical for RAG: when a chunk matches a query, retrieve
        surrounding chunks to provide fuller context.
        
        Args:
            tenant_id: Tenant ID
            doc_id: Document ID
            chunk_id: Center chunk ID
            window: Number of chunks before/after (default 2)
            
        Returns:
            List of chunks in window [chunk_id-window, chunk_id+window]
            
        Example:
            If chunk 10 matches query, neighbors(tenant, doc, 10, window=2)
            returns chunks [8, 9, 10, 11, 12] for broader context.
        """
        start_id = max(0, chunk_id - window)
        end_id = chunk_id + window
        return self.get_chunk_range(tenant_id, doc_id, start_id, end_id)

    def iter_doc(
        self, 
        tenant_id: str, 
        doc_id: str
    ) -> Iterable[ChunkMeta]:
        """
        Memory-efficient streaming iteration over document chunks.
        
        Args:
            tenant_id: Tenant ID
            doc_id: Document ID
            
        Yields:
            ChunkMeta objects in order
        """
        low = (tenant_id, doc_id, 0)
        high = (tenant_id, doc_id, 10**18)
        for _, meta in self.tree.iter_range(low, high):
            yield meta

    def find_duplicates(
        self, 
        content_hash: str
    ) -> List[ChunkMeta]:
        """
        Find all chunks with identical content hash.
        
        Useful for:
        - Deduplication
        - Finding copied content
        - Cross-document analysis
        
        Args:
            content_hash: SHA-256 hash of chunk content
            
        Returns:
            List of chunks with matching hash
        """
        return self.by_hash.get(content_hash, [])

    def count_doc_chunks(
        self, 
        tenant_id: str, 
        doc_id: str
    ) -> int:
        """
        Count chunks in a document without loading them.
        
        Args:
            tenant_id: Tenant ID
            doc_id: Document ID
            
        Returns:
            Number of chunks
        """
        low = (tenant_id, doc_id, 0)
        high = (tenant_id, doc_id, 10**18)
        return self.tree.count_range(low, high)

    def get_stats(self) -> Dict[str, int]:
        """
        Get index statistics.
        
        Returns:
            Dictionary with total_chunks, unique_hashes, etc.
        """
        return {
            "total_chunks": len(self.by_id),
            "unique_hashes": len(self.by_hash),
            "avg_chunks_per_hash": (
                len(self.by_id) / len(self.by_hash) if self.by_hash else 0
            ),
        }


# Global index instance
rag_chunk_index = RagChunkBPlusIndex(order=64)
