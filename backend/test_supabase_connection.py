#!/usr/bin/env python3
"""
Test Supabase Storage connection and permissions.
"""

import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

print("="*80)
print("🔍 Supabase Storage Connection Test".center(80))
print("="*80)

# Check environment variables
print("\n1️⃣ Checking environment variables...")
supabase_url = os.getenv("SUPABASE_URL")
supabase_service_key = os.getenv("SUPABASE_SERVICE_KEY")

if not supabase_url:
    print("   ❌ SUPABASE_URL not found in environment")
else:
    print(f"   ✅ SUPABASE_URL: {supabase_url[:30]}...")

if not supabase_service_key:
    print("   ❌ SUPABASE_SERVICE_KEY not found in environment")
else:
    print(f"   ✅ SUPABASE_SERVICE_KEY: {supabase_service_key[:20]}...")

if not supabase_url or not supabase_service_key:
    print("\n💡 Add these to your backend/.env file:")
    print("   SUPABASE_URL=https://your-project.supabase.co")
    print("   SUPABASE_SERVICE_KEY=your-service-role-key")
    exit(1)

# Test Supabase connection
print("\n2️⃣ Testing Supabase connection...")
try:
    from supabase import create_client, Client
    supabase: Client = create_client(supabase_url, supabase_service_key)
    print("   ✅ Supabase client created successfully")
except Exception as e:
    print(f"   ❌ Failed to create Supabase client: {e}")
    print("\n💡 Make sure you have installed: pip install supabase")
    exit(1)

# Test storage bucket access
print("\n3️⃣ Testing storage bucket access...")
bucket_name = "Multiagent_Skincancer_RAG"
try:
    # Try to list files in bucket
    response = supabase.storage.from_(bucket_name).list()
    print(f"   ✅ Successfully connected to bucket: {bucket_name}")
    print(f"   📊 Found {len(response)} items in bucket")

    if response:
        print("\n   📁 Current files/folders:")
        for item in response[:5]:  # Show first 5 items
            print(f"      - {item.get('name', 'Unknown')}")
        if len(response) > 5:
            print(f"      ... and {len(response) - 5} more")
    else:
        print("   📭 Bucket is empty (ready for uploads)")

except Exception as e:
    print(f"   ❌ Failed to access bucket: {e}")
    print("\n💡 Possible issues:")
    print("   1. Bucket name might be wrong")
    print("   2. Service role key might not have storage permissions")
    print("   3. Bucket might not exist")
    print("\n   Check your Supabase Dashboard → Storage")
    exit(1)

# Test upload permission
print("\n4️⃣ Testing upload permission...")
try:
    test_content = b"Test file content"
    test_path = "test_upload.txt"

    # Try to upload a test file
    supabase.storage.from_(bucket_name).upload(
        test_path,
        test_content,
        file_options={"content-type": "text/plain"}
    )
    print(f"   ✅ Successfully uploaded test file: {test_path}")

    # Try to delete the test file
    supabase.storage.from_(bucket_name).remove([test_path])
    print(f"   ✅ Successfully deleted test file")

except Exception as e:
    error_msg = str(e)
    print(f"   ❌ Upload test failed: {error_msg}")

    if "already exists" in error_msg.lower():
        print("   💡 File already exists, trying to delete it first...")
        try:
            supabase.storage.from_(bucket_name).remove([test_path])
            print("   ✅ Cleaned up existing test file")
        except:
            pass
    elif "policy" in error_msg.lower() or "permission" in error_msg.lower():
        print("\n💡 Permission issue detected:")
        print("   1. Go to Supabase Dashboard → Storage → Your bucket")
        print("   2. Click 'Policies' tab")
        print("   3. Make sure there are policies allowing INSERT/DELETE")
        print("   4. Service role key should bypass RLS, so this is unusual")
    exit(1)

print("\n" + "="*80)
print("✅ All tests passed! Supabase Storage is ready to use.".center(80))
print("="*80)
print("\n📌 You can now run: python migrate_local_to_storage.py")
