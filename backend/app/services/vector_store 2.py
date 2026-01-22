"""Vector store service using FAISS for document retrieval."""
import faiss
import numpy as np
import pickle
import os
from typing import List, Tuple, Dict, Any
from pathlib import Path
from app.config import settings
from app.services.embeddings import embedding_service
from app.models.schemas import Document


class VectorStore:
    """FAISS-based vector store for document retrieval."""
    
    def __init__(self):
        """Initialize the vector store."""
        self.index = None
        self.documents = []
        self.metadata = []
        self.index_path = Path(settings.vector_db_path)
        self.dimension = None
        
    def build_index(self, documents: List[str], metadata: List[Dict[str, Any]]):
        """
        Build FAISS index from documents.
        
        Args:
            documents: List of document texts
            metadata: List of metadata dicts for each document
        """
        print(f"Building index for {len(documents)} documents...")
        
        # Generate embeddings
        embeddings = embedding_service.embed_texts(documents)
        self.dimension = embeddings.shape[1]
        
        # Create FAISS index
        self.index = faiss.IndexFlatL2(self.dimension)
        self.index.add(embeddings.astype('float32'))
        
        # Store documents and metadata
        self.documents = documents
        self.metadata = metadata
        
        print(f"Index built successfully with {self.index.ntotal} vectors")
    
    def save_index(self):
        """Save the FAISS index and documents to disk."""
        self.index_path.mkdir(parents=True, exist_ok=True)
        
        # Save FAISS index
        faiss.write_index(self.index, str(self.index_path / "index.faiss"))
        
        # Save documents and metadata
        with open(self.index_path / "documents.pkl", "wb") as f:
            pickle.dump({
                "documents": self.documents,
                "metadata": self.metadata,
                "dimension": self.dimension
            }, f)
        
        print(f"Index saved to {self.index_path}")
    
    def load_index(self) -> bool:
        """
        Load the FAISS index from disk.
        
        Returns:
            True if loaded successfully, False otherwise
        """
        try:
            index_file = self.index_path / "index.faiss"
            docs_file = self.index_path / "documents.pkl"
            
            if not index_file.exists() or not docs_file.exists():
                print(f"Index files not found at {self.index_path}")
                return False
            
            # Load FAISS index
            self.index = faiss.read_index(str(index_file))
            
            # Load documents and metadata
            with open(docs_file, "rb") as f:
                data = pickle.load(f)
                self.documents = data["documents"]
                self.metadata = data["metadata"]
                self.dimension = data["dimension"]
            
            print(f"Index loaded successfully: {self.index.ntotal} vectors")
            return True
            
        except Exception as e:
            print(f"Error loading index: {e}")
            return False
    
    def search(self, query: str, top_k: int = 5) -> List[Document]:
        """
        Search for similar documents.
        
        Args:
            query: Query text
            top_k: Number of results to return
            
        Returns:
            List of Document objects with content, metadata, and scores
        """
        if self.index is None or self.index.ntotal == 0:
            print("Index is empty or not loaded")
            return []
        
        # Generate query embedding
        query_embedding = embedding_service.embed_text(query)
        query_embedding = query_embedding.reshape(1, -1).astype('float32')
        
        # Search
        distances, indices = self.index.search(query_embedding, min(top_k, self.index.ntotal))
        
        # Convert distances to similarity scores (lower distance = higher similarity)
        # Using exponential decay: score = exp(-distance)
        scores = np.exp(-distances[0])
        
        # Build results
        results = []
        for idx, score in zip(indices[0], scores):
            if idx < len(self.documents):
                results.append(Document(
                    content=self.documents[idx],
                    metadata=self.metadata[idx],
                    score=float(score)
                ))
        
        return results
    
    def is_ready(self) -> bool:
        """Check if the vector store is ready."""
        return self.index is not None and self.index.ntotal > 0


# Global vector store instance
vector_store = VectorStore()
