#!/usr/bin/env python3
"""Upload documents from knowledge_base to Supabase vector store."""
import asyncio
import os
from pathlib import Path
from typing import List, Dict
import PyPDF2

from app.config import settings
from app.services.supabase_vector_store import supabase_vector_store
from app.services.embeddings import embedding_service

# Import Supabase Storage loader
try:
    from app.utils.supabase_storage import get_storage_loader
    SUPABASE_STORAGE_AVAILABLE = True
except Exception as e:
    print(f"⚠️  Supabase Storage not available: {e}")
    SUPABASE_STORAGE_AVAILABLE = False


# Lesion class mapping based on filename
LESION_MAP = {
    'melanoma': 'MEL',
    'basal': 'BCC',
    'squamous': 'SCC',
    'actinic': 'AKIEC',
    'nevus': 'NV',
    'dermatofibroma': 'DF',
}


def extract_text_from_pdf(pdf_path: str) -> str:
    """Extract text from PDF file."""
    try:
        with open(pdf_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
        return text.strip()
    except Exception as e:
        print(f"Error reading PDF {pdf_path}: {e}")
        return ""


def read_text_file(file_path: str) -> str:
    """Read text from TXT file."""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        print(f"Error reading TXT {file_path}: {e}")
        return ""


def determine_lesion_class(filename: str) -> str:
    """Determine lesion class from filename."""
    filename_lower = filename.lower()
    for keyword, lesion_class in LESION_MAP.items():
        if keyword in filename_lower:
            return lesion_class
    return None


async def upload_document(file_path: Path) -> bool:
    """Upload a single document to Supabase."""
    try:
        print(f"\n📄 Processing: {file_path.name}")
        
        # Extract text based on file type
        if file_path.suffix.lower() == '.pdf':
            content = extract_text_from_pdf(str(file_path))
        elif file_path.suffix.lower() in ['.txt', '.md']:
            content = read_text_file(str(file_path))
        else:
            print(f"   ⚠️  Unsupported file type: {file_path.suffix}")
            return False
        
        if not content or len(content) < 100:
            print(f"   ⚠️  Content too short or empty")
            return False
        
        # Determine lesion class
        lesion_class = determine_lesion_class(file_path.stem)
        
        # Prepare metadata
        title = file_path.stem.replace('_', ' ').replace('-', ' ').title()
        
        print(f"   Title: {title}")
        print(f"   Lesion: {lesion_class or 'General'}")
        print(f"   Length: {len(content)} chars")
        
        # Upload to Supabase
        doc_id = await supabase_vector_store.add_document(
            title=title,
            content=content,
            source=file_path.name,
            source_type='guideline',
            lesion_class=lesion_class,
            tags=[lesion_class] if lesion_class else [],
            chunk_size=500
        )
        
        print(f"   ✅ Uploaded: {doc_id}")
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


async def upload_from_storage_document(doc: Dict[str, str]) -> bool:
    """Upload a document from Supabase Storage."""
    try:
        print(f"\n📄 Processing: {doc['name']}")

        content = doc.get('content', '')
        if not content or len(content) < 100:
            print(f"   ⚠️  Content too short or empty")
            return False

        # Get lesion class from document metadata
        lesion_class = doc.get('lesion_class')

        # Prepare title
        title = Path(doc['name']).stem.replace('_', ' ').replace('-', ' ').title()

        print(f"   Title: {title}")
        print(f"   Lesion: {lesion_class or 'General'}")
        print(f"   Length: {len(content)} chars")
        print(f"   Source: Supabase Storage")

        # Upload to Supabase vector store
        doc_id = await supabase_vector_store.add_document(
            title=title,
            content=content,
            source=doc['path'],
            source_type='supabase_storage',
            lesion_class=lesion_class,
            tags=[lesion_class] if lesion_class else [],
            chunk_size=500
        )

        print(f"   ✅ Uploaded: {doc_id}")
        return True

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


async def main():
    """Main upload process."""
    print("="*80)
    print("🚀 MIDAS - Upload Documents to Supabase Vector Store".center(80))
    print("="*80)

    # Initialize services
    print("\n📦 Initializing services...")

    # Initialize Supabase
    if not supabase_vector_store.initialize():
        print("❌ Failed to initialize Supabase")
        return

    # Load embedding model
    print("📦 Loading embedding model...")
    embedding_service.load_model()

    # Determine source: Supabase Storage or local files
    use_storage = settings.use_supabase_storage and SUPABASE_STORAGE_AVAILABLE

    all_files = []
    documents_from_storage = []

    if use_storage:
        print("\n📦 Using Supabase Storage as source")
        storage_loader = get_storage_loader()

        # Get all documents from storage
        documents_from_storage = storage_loader.get_all_documents()

        print(f"\n📚 Found {len(documents_from_storage)} documents in Supabase Storage")

        if not documents_from_storage:
            print("\n⚠️  No documents found in Supabase Storage")
            print("   💡 Upload documents via the frontend at /dashboard/documents")
            return
    else:
        print("\n📦 Using local files as source")

        # Get knowledge base path
        kb_path = Path(settings.knowledge_base_path)
        if not kb_path.exists():
            print(f"❌ Knowledge base path not found: {kb_path}")
            return

        # Find all documents
        pdf_files = list(kb_path.glob("*.pdf"))
        txt_files = list(kb_path.glob("*.txt"))
        md_files = list(kb_path.glob("*.md"))

        all_files = pdf_files + txt_files + md_files

        print(f"\n📚 Found {len(all_files)} documents:")
        print(f"   PDFs: {len(pdf_files)}")
        print(f"   TXTs: {len(txt_files)}")
        print(f"   MDs:  {len(md_files)}")

        if not all_files:
            print("\n⚠️  No documents found to upload")
            return
    
    # Upload each document
    print("\n" + "="*80)
    print("📤 Starting upload...".center(80))
    print("="*80)

    success_count = 0
    fail_count = 0

    if use_storage:
        # Upload from Supabase Storage
        for doc in documents_from_storage:
            success = await upload_from_storage_document(doc)
            if success:
                success_count += 1
            else:
                fail_count += 1
        total_count = len(documents_from_storage)
    else:
        # Upload from local files
        for file_path in all_files:
            success = await upload_document(file_path)
            if success:
                success_count += 1
            else:
                fail_count += 1
        total_count = len(all_files)
    
    # Summary
    print("\n" + "="*80)
    print("📊 Upload Summary".center(80))
    print("="*80)
    print(f"✅ Successful: {success_count}")
    print(f"❌ Failed:     {fail_count}")
    print(f"📝 Total:      {total_count}")
    
    # Get final stats
    stats = await supabase_vector_store.get_document_stats()
    print("\n📈 Vector Store Stats:")
    print(f"   Total documents: {stats.get('total_documents', 0)}")
    print(f"   Total embeddings: {stats.get('total_embeddings', 0)}")
    print(f"   Avg chunks/doc: {stats.get('avg_chunks_per_doc', 0):.1f}")
    
    if stats.get('lesion_distribution'):
        print("\n🎯 Lesion Distribution:")
        for lesion, count in stats['lesion_distribution'].items():
            print(f"   {lesion}: {count}")
    
    print("\n✅ Upload complete!")


if __name__ == "__main__":
    asyncio.run(main())
