"""Retriever agent for document search."""
from typing import List
from app.services.vector_store import vector_store
from app.models.schemas import Document
from app.config import settings


class Retriever:
    """Agent that retrieves relevant documents from vector store."""
    
    def __init__(self):
        """Initialize the retriever."""
        self.top_k = settings.top_k_documents
    
    async def retrieve(self, query: str, top_k: int = None) -> List[Document]:
        """
        Retrieve relevant documents for the query.
        
        Args:
            query: User's question
            top_k: Number of documents to retrieve (overrides default)
            
        Returns:
            List of relevant Document objects
        """
        k = top_k or self.top_k
        
        try:
            documents = vector_store.search(query, top_k=k)
            return documents
        except Exception as e:
            print(f"Error in retriever: {e}")
            return []


# Global retriever instance
retriever = Retriever()
