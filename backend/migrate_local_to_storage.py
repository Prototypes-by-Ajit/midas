#!/usr/bin/env python3
"""
Migrate local documents from knowledge_base directory to Supabase Storage.
This script uploads all local PDF, TXT, and MD files to the Supabase Storage bucket.
"""

import os
from pathlib import Path
from typing import List
import mimetypes

from app.config import settings
from app.utils.supabase_storage import get_storage_loader

# MIME type mapping
MIME_TYPES = {
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
}


def get_local_documents() -> List[Path]:
    """Get all documents from local knowledge base directory."""
    kb_path = Path(settings.knowledge_base_path)

    if not kb_path.exists():
        print(f"❌ Knowledge base path not found: {kb_path}")
        return []

    # Find all supported documents
    pdf_files = list(kb_path.glob("*.pdf"))
    txt_files = list(kb_path.glob("*.txt"))
    md_files = list(kb_path.glob("*.md"))

    all_files = pdf_files + txt_files + md_files

    return all_files


def upload_file_to_storage(file_path: Path, storage_loader) -> bool:
    """
    Upload a single file to Supabase Storage.

    Args:
        file_path: Path to the local file
        storage_loader: SupabaseStorageLoader instance

    Returns:
        True if successful, False otherwise
    """
    try:
        print(f"\n📄 Uploading: {file_path.name}")

        # Read file content
        with open(file_path, 'rb') as f:
            content = f.read()

        # Determine MIME type
        ext = file_path.suffix.lower()
        content_type = MIME_TYPES.get(ext, 'application/octet-stream')

        # Upload to storage (at root level, not in user folders)
        # Using 'knowledge_base/' prefix to organize files
        storage_path = f"knowledge_base/{file_path.name}"

        # Check if file already exists
        existing_files = storage_loader.list_files(path="knowledge_base", file_extensions=[ext])
        if any(f['name'] == file_path.name for f in existing_files):
            print(f"   ⚠️  File already exists in storage, skipping")
            return True

        # Upload
        success = storage_loader.upload_file(storage_path, content, content_type)

        if success:
            print(f"   ✅ Uploaded to: {storage_path}")
            print(f"   Size: {len(content)} bytes")
            print(f"   Type: {content_type}")
            return True
        else:
            print(f"   ❌ Upload failed")
            return False

    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def main():
    """Main migration process."""
    print("="*80)
    print("🚀 Migrate Local Documents to Supabase Storage".center(80))
    print("="*80)

    # Get local documents
    print("\n📚 Scanning local knowledge base...")
    local_files = get_local_documents()

    if not local_files:
        print("\n⚠️  No local documents found to migrate")
        print(f"   Path checked: {settings.knowledge_base_path}")
        return

    print(f"\n📊 Found {len(local_files)} local documents:")
    pdf_count = sum(1 for f in local_files if f.suffix.lower() == '.pdf')
    txt_count = sum(1 for f in local_files if f.suffix.lower() == '.txt')
    md_count = sum(1 for f in local_files if f.suffix.lower() == '.md')

    print(f"   PDFs: {pdf_count}")
    print(f"   TXTs: {txt_count}")
    print(f"   MDs:  {md_count}")

    # Initialize storage loader
    print("\n📦 Initializing Supabase Storage...")
    try:
        storage_loader = get_storage_loader()
        print(f"   ✅ Connected to bucket: {storage_loader.bucket_name}")
    except Exception as e:
        print(f"   ❌ Failed to initialize storage: {e}")
        print("\n💡 Make sure SUPABASE_URL and SUPABASE_SERVICE_KEY are set in .env")
        return

    # Confirm migration
    print("\n" + "="*80)
    response = input(f"📤 Ready to upload {len(local_files)} files to Supabase Storage. Continue? (y/n): ")
    if response.lower() != 'y':
        print("\n⏸️  Migration cancelled")
        return

    # Upload each file
    print("\n" + "="*80)
    print("📤 Starting upload...".center(80))
    print("="*80)

    success_count = 0
    skip_count = 0
    fail_count = 0

    for file_path in local_files:
        success = upload_file_to_storage(file_path, storage_loader)
        if success:
            # Check if it was skipped or uploaded
            existing_files = storage_loader.list_files(path="knowledge_base", file_extensions=[file_path.suffix.lower()])
            if any(f['name'] == file_path.name for f in existing_files):
                success_count += 1
        else:
            fail_count += 1

    # Summary
    print("\n" + "="*80)
    print("📊 Migration Summary".center(80))
    print("="*80)
    print(f"✅ Uploaded:   {success_count}")
    print(f"❌ Failed:     {fail_count}")
    print(f"📝 Total:      {len(local_files)}")

    if success_count > 0:
        print("\n🎉 Migration complete!")
        print("\n📌 Next steps:")
        print("   1. Verify files in Supabase Dashboard → Storage → 'Multiagent skincancer RAG' bucket")
        print("   2. Set USE_SUPABASE_STORAGE=true in backend/.env")
        print("   3. Run: python upload_to_supabase.py")
        print("      (This will process the files from Storage and create embeddings)")
    else:
        print("\n⚠️  No files were uploaded")


if __name__ == "__main__":
    main()
