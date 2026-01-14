#!/usr/bin/env python3
"""
Sync Supabase Storage files to database.
Creates database entries for files that exist in Storage but not in DB.
"""

from app.utils.supabase_storage import get_storage_loader
from supabase import create_client
import os
from pathlib import Path

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("❌ SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Lesion class mapping
LESION_MAP = {
    'melanoma': 'MEL',
    'basal': 'BCC',
    'squamous': 'SCC',
    'actinic': 'AKIEC',
    'nevus': 'NV',
    'dermatofibroma': 'DF',
}

def infer_lesion_class(filename: str):
    """Infer lesion class from filename."""
    filename_lower = filename.lower()
    for keyword, lesion_class in LESION_MAP.items():
        if keyword in filename_lower:
            return lesion_class
    return None


def main():
    print("="*80)
    print("🔄 Sync Storage Files to Database".center(80))
    print("="*80)

    # Get all files from Storage
    print("\n📦 Loading files from Supabase Storage...")
    storage_loader = get_storage_loader()
    storage_files = storage_loader.list_all_files_recursive(file_extensions=['.pdf', '.txt', '.md'])

    print(f"   Found {len(storage_files)} files in Storage")

    # Get existing documents from database
    print("\n📊 Checking existing database entries...")
    db_result = supabase.table('documents').select('storage_path').execute()
    existing_paths = {doc['storage_path'] for doc in db_result.data if doc.get('storage_path')}

    print(f"   Found {len(existing_paths)} existing database entries")

    # Find files that need database entries
    files_to_sync = []
    for file in storage_files:
        storage_path = file.get('full_path', file.get('name'))
        if storage_path not in existing_paths:
            files_to_sync.append(file)

    if not files_to_sync:
        print("\n✅ All Storage files already have database entries!")
        print("   No sync needed.")
        return

    print(f"\n📝 Found {len(files_to_sync)} files without database entries:")
    for f in files_to_sync:
        print(f"   - {f.get('full_path', f.get('name'))}")

    # Confirm sync
    response = input(f"\n🔄 Create database entries for {len(files_to_sync)} files? (y/n): ")
    if response.lower() != 'y':
        print("\n⏸️  Sync cancelled")
        return

    # Create database entries
    print("\n" + "="*80)
    print("📝 Creating database entries...".center(80))
    print("="*80)

    success_count = 0
    fail_count = 0

    for file in files_to_sync:
        storage_path = file.get('full_path', file.get('name'))
        file_name = Path(storage_path).name
        file_size = file.get('metadata', {}).get('size', 0)

        print(f"\n📄 Creating entry for: {file_name}")

        # Infer lesion class
        lesion_class = infer_lesion_class(file_name)

        # Prepare title
        title = Path(file_name).stem.replace('_', ' ').replace('-', ' ').title()

        try:
            # Insert into database
            result = supabase.table('documents').insert({
                'title': title,
                'file_name': file_name,
                'content': '',  # Will be filled during processing
                'storage_path': storage_path,
                'file_size': file_size,
                'uploaded_by': 'system',
                'source': 'migrated_from_storage',
                'source_type': 'file',
                'status': 'pending',
                'lesion_class': lesion_class,
                'tags': [lesion_class] if lesion_class else [],
            }).execute()

            print(f"   ✅ Created database entry")
            print(f"   ID: {result.data[0]['id']}")
            print(f"   Title: {title}")
            print(f"   Lesion: {lesion_class or 'General'}")
            success_count += 1

        except Exception as e:
            print(f"   ❌ Failed: {e}")
            fail_count += 1

    # Summary
    print("\n" + "="*80)
    print("📊 Sync Summary".center(80))
    print("="*80)
    print(f"✅ Success: {success_count}")
    print(f"❌ Failed:  {fail_count}")
    print(f"📝 Total:   {len(files_to_sync)}")

    if success_count > 0:
        print("\n🎉 Database sync complete!")
        print("\n📌 Next steps:")
        print("   1. Refresh the frontend documents page")
        print("   2. You should now see the documents listed")
        print("   3. Run: python upload_to_supabase.py")
        print("      (This will process the files and create embeddings)")


if __name__ == "__main__":
    main()
