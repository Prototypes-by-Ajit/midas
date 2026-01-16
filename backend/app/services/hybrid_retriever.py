"""
Hybrid Retrieval Service combining dense (pgvector) + sparse (BM25) retrieval.
Wraps existing SupabaseVectorStore without modification.
"""

import logging
from typing import List, Dict, Optional, Any
from collections import defaultdict
import numpy as np
from rank_bm25 import BM25Okapi
from sentence_transformers import CrossEncoder

logger = logging.getLogger(__name__)


class HybridRetriever:
    """
    Hybrid retriever combining dense and sparse retrieval with reranking.

    Architecture:
    1. Dense retrieval: Supabase pgvector (semantic search)
    2. Sparse retrieval: BM25 (keyword matching)
    3. Fusion: Reciprocal Rank Fusion (RRF)
    4. Reranking: Cross-encoder for final scoring
    """

    def __init__(self, supabase_vector_store, reranker_model: str = 'cross-encoder/ms-marco-MiniLM-L-6-v2'):
        """
        Initialize hybrid retriever.

        Args:
            supabase_vector_store: Existing SupabaseVectorStore instance
            reranker_model: Cross-encoder model for reranking
        """
        self.supabase_store = supabase_vector_store

        # BM25 index (will be built from Supabase documents)
        self.bm25 = None
        self.documents_cache = []
        self.document_ids = []
        self.is_initialized = False

        # Reranker (Cross-Encoder for relevance scoring)
        logger.info(f"Loading reranker model: {reranker_model}")
        self.reranker = CrossEncoder(reranker_model)

        logger.info("HybridRetriever initialized (BM25 index will be built on first use)")

    async def _build_bm25_index(self):
        """
        Build BM25 index from Supabase documents.
        Fetches all chunks from embeddings table once at startup.
        """
        if self.is_initialized:
            return

        try:
            logger.info("Building BM25 index from Supabase embeddings table...")

            # Query Supabase for all document chunks
            result = self.supabase_store.client.table('embeddings') \
                .select('chunk_text, document_id, id') \
                .execute()

            if not result.data:
                logger.warning("No documents found in embeddings table for BM25 indexing")
                self.is_initialized = True
                return

            # Cache documents and IDs
            self.documents_cache = [row['chunk_text'] for row in result.data]
            self.document_ids = [row['id'] for row in result.data]

            # Tokenize for BM25 (simple whitespace tokenization)
            tokenized_docs = [doc.split() for doc in self.documents_cache]
            self.bm25 = BM25Okapi(tokenized_docs)

            self.is_initialized = True
            logger.info(f"BM25 index built with {len(self.documents_cache)} documents")

        except Exception as e:
            logger.error(f"Failed to build BM25 index: {e}")
            self.is_initialized = True  # Mark as initialized to avoid retry loops

    async def retrieve(
        self,
        query: str,
        top_k: int = 10,
        rerank_top_n: int = 5,
        lesion_class: Optional[str] = None,
        rrf_k: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Hybrid retrieval with reranking.

        Pipeline:
        1. Dense retrieval (Supabase pgvector) - top 20
        2. Sparse retrieval (BM25) - top 20
        3. Reciprocal Rank Fusion (RRF) to combine rankings
        4. Rerank top K with cross-encoder
        5. Return top N results

        Args:
            query: User query
            top_k: Number of candidates to rerank (default 10)
            rerank_top_n: Final number of results to return (default 5)
            lesion_class: Optional filter (MEL, NV, BCC, etc.)
            rrf_k: RRF parameter (default 60)

        Returns:
            List of search results with scores
        """
        # Build BM25 index on first use
        if not self.is_initialized:
            await self._build_bm25_index()

        try:
            # Step 1: Dense retrieval (existing Supabase pgvector search)
            logger.debug(f"Dense retrieval for query: '{query[:50]}...'")
            dense_results = await self.supabase_store.search(
                query=query,
                top_k=20,
                match_threshold=0.3,  # Lower threshold to get more candidates
                lesion_class=lesion_class
            )

            # Step 2: Sparse retrieval (BM25)
            sparse_results = []
            if self.bm25 and self.documents_cache:
                logger.debug("BM25 sparse retrieval...")
                tokenized_query = query.split()
                bm25_scores = self.bm25.get_scores(tokenized_query)

                # Get top 20 BM25 results
                top_indices = np.argsort(bm25_scores)[-20:][::-1]

                for idx in top_indices:
                    if bm25_scores[idx] > 0:  # Only include non-zero scores
                        sparse_results.append({
                            'chunk_text': self.documents_cache[idx],
                            'score': float(bm25_scores[idx]),
                            'source': 'bm25'
                        })

            # Step 3: Reciprocal Rank Fusion (RRF)
            logger.debug(f"Fusing {len(dense_results)} dense + {len(sparse_results)} sparse results")
            fused_results = self._reciprocal_rank_fusion(
                dense_results,
                sparse_results,
                k=rrf_k
            )

            # Take top K for reranking
            candidates = fused_results[:top_k]

            if not candidates:
                logger.warning("No candidates after fusion, returning empty results")
                return []

            # Step 4: Rerank with cross-encoder
            logger.debug(f"Reranking top {len(candidates)} candidates")
            reranked_results = self._rerank(query, candidates)

            # Step 5: Return top N
            final_results = reranked_results[:rerank_top_n]

            logger.info(
                f"Hybrid retrieval complete: "
                f"{len(dense_results)} dense, {len(sparse_results)} sparse → "
                f"{len(final_results)} final results"
            )

            return final_results

        except Exception as e:
            logger.error(f"Hybrid retrieval error: {e}")
            # Fallback to dense-only retrieval
            logger.warning("Falling back to dense-only retrieval")
            return await self.supabase_store.search(
                query=query,
                top_k=rerank_top_n,
                match_threshold=0.5,
                lesion_class=lesion_class
            )

    def _reciprocal_rank_fusion(
        self,
        dense_results: List[Dict[str, Any]],
        sparse_results: List[Dict[str, Any]],
        k: int = 60
    ) -> List[Dict[str, Any]]:
        """
        Combine rankings using Reciprocal Rank Fusion.

        RRF formula: score(d) = sum(1 / (k + rank_i(d)))

        Args:
            dense_results: Results from pgvector
            sparse_results: Results from BM25
            k: Constant for RRF (typically 60)

        Returns:
            Fused results sorted by RRF score
        """
        doc_scores = defaultdict(float)
        doc_content = {}  # Store full document content

        # Score dense results (by position in ranking)
        for rank, doc in enumerate(dense_results):
            content = doc.get('chunk_text', '')
            doc_scores[content] += 1.0 / (k + rank + 1)
            if content not in doc_content:
                doc_content[content] = doc

        # Score sparse results (by position in ranking)
        for rank, doc in enumerate(sparse_results):
            content = doc.get('chunk_text', '')
            doc_scores[content] += 1.0 / (k + rank + 1)
            if content not in doc_content:
                doc_content[content] = doc

        # Sort by combined RRF score
        sorted_docs = sorted(
            doc_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        # Return documents with RRF scores
        fused_results = []
        for content, score in sorted_docs:
            doc = doc_content[content].copy()
            doc['rrf_score'] = score
            fused_results.append(doc)

        return fused_results

    def _rerank(self, query: str, docs: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Rerank documents using cross-encoder for relevance.

        Args:
            query: User query
            docs: Documents to rerank

        Returns:
            Documents sorted by cross-encoder relevance score
        """
        if not docs:
            return []

        try:
            # Prepare query-document pairs for cross-encoder
            pairs = [
                [query, doc.get('chunk_text', '')]
                for doc in docs
            ]

            # Score with cross-encoder (higher score = more relevant)
            scores = self.reranker.predict(pairs)

            # Attach scores to documents
            for i, doc in enumerate(docs):
                doc['rerank_score'] = float(scores[i])

            # Sort by reranking score (descending)
            docs.sort(key=lambda x: x.get('rerank_score', 0), reverse=True)

            return docs

        except Exception as e:
            logger.error(f"Reranking error: {e}, returning original order")
            return docs

    def get_stats(self) -> Dict[str, Any]:
        """
        Get statistics about the hybrid retriever.

        Returns:
            Dictionary with BM25 index stats
        """
        return {
            'is_initialized': self.is_initialized,
            'num_documents': len(self.documents_cache),
            'bm25_enabled': self.bm25 is not None,
            'reranker_model': self.reranker.model.config.name_or_path if self.reranker else None
        }
