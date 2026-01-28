"""Script to build vector index from knowledge base documents."""
import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from app.services.vector_store import vector_store
from app.services.embeddings import embedding_service
from app.config import settings
from app.indexing.rag_chunk_index import rag_chunk_index


def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    """
    Split text into chunks with overlap.
    
    Args:
        text: Text to chunk
        chunk_size: Size of each chunk in characters
        overlap: Overlap between chunks
        
    Returns:
        List of text chunks
    """
    chunks = []
    start = 0
    
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end]
        
        # Try to end at a sentence boundary
        if end < len(text):
            last_period = chunk.rfind('.')
            last_newline = chunk.rfind('\n')
            break_point = max(last_period, last_newline)
            if break_point > chunk_size * 0.5:  # At least 50% of chunk size
                chunk = chunk[:break_point + 1]
                end = start + break_point + 1
        
        chunks.append(chunk.strip())
        start = end - overlap
    
    return chunks


def load_documents():
    """Load and chunk all documents from knowledge base."""
    kb_path = Path(settings.knowledge_base_path)
    
    if not kb_path.exists():
        print(f"❌ Knowledge base path not found: {kb_path}")
        return [], []
    
    documents = []
    metadata = []
    
    print(f"📚 Loading documents from {kb_path}\n")
    
    for file_path in kb_path.glob("*.txt"):
        print(f"   Processing: {file_path.name}")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Chunk the document
        chunks = chunk_text(content)
        print(f"      Created {len(chunks)} chunks")
        
        # Add chunks to documents
        for i, chunk in enumerate(chunks):
            documents.append(chunk)
            metadata.append({
                "source": file_path.stem.replace('_', ' ').title(),
                "file": file_path.name,
                "chunk_id": i,
                "total_chunks": len(chunks)
            })
    
    print(f"\n✅ Loaded {len(documents)} document chunks from {len(list(kb_path.glob('*.txt')))} files\n")
    
    return documents, metadata


def main():
    """Main function to build the index."""
    print("="*60)
    print("MIDAS Knowledge Base Index Builder")
    print("="*60 + "\n")
    
    # Load documents
    documents, metadata = load_documents()
    
    if not documents:
        print("❌ No documents found. Please add .txt files to the knowledge base directory.")
        return
    
    # Load embedding model
    print("📦 Loading embedding model...")
    embedding_service.load_model()
    print(f"   Model: {settings.embedding_model}")
    print(f"   Dimension: {embedding_service.get_dimension()}\n")
    
    # Build FAISS index
    print("🔨 Building FAISS index...")
    vector_store.build_index(documents, metadata)
    
    # Build B+ tree index for efficient chunk retrieval
    print("\n🌳 Building B+ tree index...")
    tenant_id = "default"
    bplus_chunks_indexed = 0
    
    # Group documents by source file for proper document ID assignment
    doc_groups = {}
    for i, meta in enumerate(metadata):
        source = meta.get("file", f"doc_{i}")
        if source not in doc_groups:
            doc_groups[source] = []
        doc_groups[source].append((i, meta))
    
    for doc_id, (source, items) in enumerate(doc_groups.items()):
        # Get all chunks for this document
        doc_chunks = []
        doc_metadata_list = []
        for idx, meta in items:
            doc_chunks.append(documents[idx])
            doc_metadata_list.append(meta)
        
        # Combine chunks into full document text for B+ tree indexing
        # Note: B+ tree uses character-based chunking, so we reconstruct the document
        full_text = " ".join(doc_chunks)
        
        # Index document in B+ tree
        chunk_metas = rag_chunk_index.index_document(
            tenant_id=tenant_id,
            doc_id=source,  # Use source file name as doc_id
            text=full_text,
            chunk_size=800,  # Match chunk_size used in chunk_text function
            overlap=100,  # Match overlap used in chunk_text function
            source=source,
            lesion_class=None
        )
        bplus_chunks_indexed += len(chunk_metas)
        print(f"   Indexed {len(chunk_metas)} chunks for document: {source}")
    
    print(f"✅ B+ tree index built: {bplus_chunks_indexed} chunks indexed")
    
    # Get B+ tree statistics
    stats = rag_chunk_index.get_stats()
    print(f"   Total chunks in B+ tree: {stats['total_chunks']}")
    print(f"   Unique content hashes: {stats['unique_hashes']}")
    
    # Save FAISS index
    print(f"\n💾 Saving FAISS index to {settings.vector_db_path}...")
    vector_store.save_index()
    
    # Note: B+ tree index is in-memory and will be rebuilt on each run
    # For persistence, you would need to implement serialization
    print("   Note: B+ tree index is in-memory (will be rebuilt on restart)")
    
    print("\n" + "="*60)
    print("✅ Index built successfully!")
    print("="*60)
    print(f"\nTotal document chunks: {len(documents)}")
    print(f"FAISS index location: {settings.vector_db_path}")
    print(f"B+ tree chunks indexed: {bplus_chunks_indexed}")
    print("\nYou can now start the API server:")
    print("  cd backend")
    print("  python -m app.main")


if __name__ == "__main__":
    main()
