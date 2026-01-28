#!/usr/bin/env python3
"""
Script to fix documents stuck in 'processing' status.
This script will re-process them via the backend API.

Usage (from backend directory with venv activated):
    source ../venv/bin/activate  # or activate your venv
    python fix_stuck_documents.py
"""

import sys
import os
from pathlib import Path

# Ensure we're in the backend directory
backend_dir = Path(__file__).parent
os.chdir(backend_dir)
sys.path.insert(0, str(backend_dir))

from supabase import create_client
from app.config import settings
import requests
import time

def fix_stuck_documents():
    """Find and fix documents stuck in processing status."""
    
    # Initialize Supabase client
    supabase = create_client(
        settings.supabase_url,
        settings.supabase_service_key
    )
    
    # Find documents stuck in processing
    print("🔍 Searching for documents stuck in 'processing' status...")
    result = supabase.table('documents').select('*').eq('status', 'processing').execute()
    
    stuck_docs = result.data
    print(f"📊 Found {len(stuck_docs)} documents stuck in processing\n")
    
    if not stuck_docs:
        print("✅ No stuck documents found!")
        return
    
    # Get backend URL (default port is 8000 per config.py)
    backend_url = os.getenv('BACKEND_URL', 'http://localhost:8000')
    print(f"🔗 Backend URL: {backend_url}\n")
    
    for doc in stuck_docs:
        doc_id = doc['id']
        file_name = doc.get('file_name', 'Unknown')
        print(f"📄 Processing: {file_name} (ID: {doc_id})")
        
        try:
            # Call backend to process
            response = requests.post(
                f"{backend_url}/api/v1/documents/{doc_id}/process",
                json={"document_id": doc_id},
                timeout=60
            )
            
            if response.status_code == 200:
                result = response.json()
                print(f"   ✅ Success: {result.get('embeddings_created', 0)} embeddings created")
                
                # Verify status was updated
                time.sleep(1)
                check = supabase.table('documents').select('status').eq('id', doc_id).single().execute()
                status = check.data.get('status', 'unknown')
                print(f"   📊 Status: {status}\n")
            else:
                print(f"   ❌ Failed: {response.status_code} - {response.text}")
                
                # Update to failed
                supabase.table('documents').update({
                    'status': 'failed'
                }).eq('id', doc_id).execute()
                print(f"   ⚠️  Updated status to 'failed'\n")
                
        except requests.exceptions.RequestException as e:
            print(f"   ❌ Error: {str(e)}")
            print(f"   💡 Make sure your backend is running at {backend_url}")
            
            # Update to failed
            try:
                supabase.table('documents').update({
                    'status': 'failed'
                }).eq('id', doc_id).execute()
                print(f"   ⚠️  Updated status to 'failed'\n")
            except Exception as update_error:
                print(f"   ❌ Failed to update status: {update_error}\n")
    
    print("✅ Done processing stuck documents!")

if __name__ == "__main__":
    fix_stuck_documents()

