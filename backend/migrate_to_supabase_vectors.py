#!/usr/bin/env python3
"""
Migrate documents from Supabase Storage to pgvector embeddings.
This script processes all pending documents and creates vector embeddings.
"""

import os
import sys
from dotenv import load_dotenv
from supabase import create_client
import asyncio
from app.services.supabase_vector_store import supabase_vector_store
from app.utils.supabase_storage import SupabaseStorageLoader
from app.services.embeddings import embedding_service

load_dotenv()

# Initialize services
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
STORAGE_BUCKET = "Multiagent_Skincancer_RAG"

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sys.exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
storage_loader = SupabaseStorageLoader(bucket_name=STORAGE_BUCKET)

print("=" * 80)
print("🚀 SUPABASE VECTOR MIGRATION".center(80))
print("=" * 80)

async def process_document(doc):
    """Process a single document: extract text and create embeddings."""
    doc_id = doc['id']
    file_name = doc['file_name']
    storage_path = doc['storage_path']

    print(f"\n📄 Processing: {file_name}")
    print(f"   ID: {doc_id}")
    print(f"   Path: {storage_path}")

    try:
        # Step 1: Extract text from storage
        print("   ⏳ Extracting text...")
        text_content = storage_loader.extract_text(storage_path)

        if not text_content or len(text_content.strip()) < 50:
            print(f"   ⚠️  Extracted text too short ({len(text_content or '')} chars)")

            # Update status to failed
            supabase.table('documents').update({
                'status': 'failed',
                'content': text_content or ''
            }).eq('id', doc_id).execute()

            return False

        print(f"   ✅ Extracted {len(text_content)} characters")

        # Step 2: Update document with content (don't change status yet)
        supabase.table('documents').update({
            'content': text_content
        }).eq('id', doc_id).execute()

        # Step 3: Create embeddings using vector store
        print("   ⏳ Creating embeddings...")

        # Chunk the text
        chunks = supabase_vector_store._chunk_text(text_content, chunk_size=500)
        print(f"   📝 Created {len(chunks)} chunks")

        # Generate and store embeddings for each chunk
        embedding_records = []
        for i, chunk in enumerate(chunks):
            # Generate embedding
            embedding = embedding_service.embed_text(chunk)

            # Prepare embedding record
            embedding_records.append({
                "document_id": doc_id,
                "embedding": embedding.tolist(),
                "chunk_text": chunk,
                "chunk_index": i,
                "chunk_size": len(chunk),
                "model_version": "all-MiniLM-L6-v2"
            })

        # Batch insert embeddings
        if embedding_records:
            supabase_vector_store.client.table("embeddings").insert(embedding_records).execute()

        print(f"   ✅ Created {len(embedding_records)} embeddings")

        # Step 4: Update document status to processed
        supabase.table('documents').update({
            'status': 'processed'
        }).eq('id', doc_id).execute()

        print(f"   ✅ Document processed successfully!")
        return True

    except Exception as e:
        print(f"   ❌ Error processing document: {e}")

        # Update status to failed
        supabase.table('documents').update({
            'status': 'failed'
        }).eq('id', doc_id).execute()

        return False


async def main():
    """Main migration function."""

    # Initialize services
    print("\n🔧 Initializing services...")

    # Initialize vector store
    if not supabase_vector_store.initialize():
        print("❌ Failed to initialize Supabase vector store")
        sys.exit(1)

    # Load embedding model
    print("🔤 Loading embedding model...")
    embedding_service.load_model()
    print(f"   Model: {embedding_service.model_name}")

    # Get pending documents
    print("\n📊 Fetching documents...")
    result = supabase.table('documents')\
        .select('id, file_name, storage_path, status')\
        .eq('status', 'pending')\
        .order('created_at', desc=False)\
        .execute()

    # Filter out documents without storage_path
    documents = [d for d in result.data if d.get('storage_path')]

    if not documents:
        print("✅ No pending documents to process!")

        # Show stats
        all_docs = supabase.table('documents').select('id', count='exact').execute()
        all_embs = supabase.table('embeddings').select('id', count='exact').execute()

        print(f"\n📊 Current Status:")
        print(f"   Total documents: {all_docs.count or 0}")
        print(f"   Total embeddings: {all_embs.count or 0}")

        return

    print(f"📋 Found {len(documents)} pending documents\n")

    # Process each document
    stats = {"success": 0, "failed": 0}

    for i, doc in enumerate(documents, 1):
        print(f"\n{'=' * 80}")
        print(f"Processing {i}/{len(documents)}")
        print('=' * 80)

        success = await process_document(doc)

        if success:
            stats["success"] += 1
        else:
            stats["failed"] += 1

    # Final stats
    print("\n" + "=" * 80)
    print("📊 MIGRATION COMPLETE".center(80))
    print("=" * 80)

    print(f"\n✅ Successfully processed: {stats['success']}")
    print(f"❌ Failed: {stats['failed']}")

    # Get final counts
    all_docs = supabase.table('documents').select('id', count='exact').execute()
    all_embs = supabase.table('embeddings').select('id', count='exact').execute()
    processed_docs = supabase.table('documents').select('id', count='exact').eq('status', 'processed').execute()

    print(f"\n📊 Database Status:")
    print(f"   Total documents: {all_docs.count or 0}")
    print(f"   Processed documents: {processed_docs.count or 0}")
    print(f"   Total embeddings: {all_embs.count or 0}")

    print("\n" + "=" * 80)
    print("🎉 Your RAG system is now using Supabase pgvector!".center(80))
    print("=" * 80)


if __name__ == "__main__":
    asyncio.run(main())
