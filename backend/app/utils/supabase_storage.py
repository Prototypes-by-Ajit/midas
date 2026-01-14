"""
Supabase Storage Utility
Handles file operations with Supabase Storage bucket for document management.
"""

import os
import io
from typing import List, Dict, Optional
from pathlib import Path
from supabase import create_client, Client
import PyPDF2

# Initialize Supabase client
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")  # Service role key for backend operations

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    raise ValueError("SUPABASE_URL and SUPABASE_SERVICE_KEY environment variables must be set")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

# Storage bucket name
STORAGE_BUCKET = "Multiagent_Skincancer_RAG"


class SupabaseStorageLoader:
    """Load and manage documents from Supabase Storage."""

    def __init__(self, bucket_name: str = STORAGE_BUCKET):
        self.bucket_name = bucket_name
        self.client = supabase

    def list_files(self, path: str = "", file_extensions: Optional[List[str]] = None) -> List[Dict]:
        """
        List all files in the storage bucket.

        Args:
            path: Path within the bucket (default: root)
            file_extensions: Filter by file extensions (e.g., ['.pdf', '.txt', '.md'])

        Returns:
            List of file metadata dicts
        """
        try:
            response = self.client.storage.from_(self.bucket_name).list(path)

            if file_extensions:
                # Filter by extensions
                filtered = [
                    f for f in response
                    if any(f['name'].lower().endswith(ext.lower()) for ext in file_extensions)
                ]
                return filtered

            return response
        except Exception as e:
            print(f"Error listing files from Supabase Storage: {e}")
            return []

    def list_all_files_recursive(self, path: str = "", file_extensions: Optional[List[str]] = None) -> List[Dict]:
        """
        Recursively list all files in the storage bucket, including subdirectories.

        Args:
            path: Path within the bucket (default: root)
            file_extensions: Filter by file extensions

        Returns:
            List of file metadata dicts with full paths
        """
        all_files = []

        try:
            items = self.client.storage.from_(self.bucket_name).list(path)

            for item in items:
                item_path = f"{path}/{item['name']}" if path else item['name']

                # Check if it's a folder (id is None for folders in Supabase Storage)
                if item.get('id') is None:
                    # Recursively list files in this folder
                    all_files.extend(self.list_all_files_recursive(item_path, file_extensions))
                else:
                    # It's a file
                    if file_extensions:
                        if any(item['name'].lower().endswith(ext.lower()) for ext in file_extensions):
                            item['full_path'] = item_path
                            all_files.append(item)
                    else:
                        item['full_path'] = item_path
                        all_files.append(item)

        except Exception as e:
            print(f"Error listing files recursively from path '{path}': {e}")

        return all_files

    def download_file(self, file_path: str) -> Optional[bytes]:
        """
        Download a file from Supabase Storage.

        Args:
            file_path: Full path to the file in the bucket

        Returns:
            File content as bytes, or None if error
        """
        try:
            response = self.client.storage.from_(self.bucket_name).download(file_path)
            return response
        except Exception as e:
            print(f"Error downloading file {file_path}: {e}")
            return None

    def extract_text(self, file_path: str) -> Optional[str]:
        """
        Download and extract text from a file.

        Args:
            file_path: Full path to the file in the bucket

        Returns:
            Extracted text content, or None if error
        """
        content = self.download_file(file_path)
        if not content:
            return None

        # Get file extension
        ext = Path(file_path).suffix.lower()

        try:
            if ext == '.pdf':
                return self._extract_pdf_text(content)
            elif ext in ['.txt', '.md']:
                return content.decode('utf-8')
            else:
                print(f"Unsupported file type: {ext}")
                return None
        except Exception as e:
            print(f"Error extracting text from {file_path}: {e}")
            return None

    def _extract_pdf_text(self, pdf_content: bytes) -> str:
        """Extract text from PDF bytes."""
        try:
            pdf_file = io.BytesIO(pdf_content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            return text.strip()
        except Exception as e:
            print(f"Error extracting PDF text: {e}")
            return ""

    def get_all_documents(self) -> List[Dict[str, str]]:
        """
        Get all documents from storage with their text content.

        Returns:
            List of dicts with 'path', 'name', 'content', and 'lesion_class' keys
        """
        documents = []

        # List all supported files recursively
        files = self.list_all_files_recursive(file_extensions=['.pdf', '.txt', '.md'])

        for file in files:
            file_path = file.get('full_path', file.get('name', ''))
            if not file_path:
                continue

            print(f"Processing: {file_path}")

            # Extract text
            text = self.extract_text(file_path)
            if not text:
                print(f"Skipping {file_path} - no text extracted")
                continue

            # Determine lesion class from filename
            lesion_class = self._infer_lesion_class(file_path)

            documents.append({
                'path': file_path,
                'name': Path(file_path).name,
                'content': text,
                'lesion_class': lesion_class,
                'source': 'supabase_storage',
            })

        return documents

    def _infer_lesion_class(self, filename: str) -> Optional[str]:
        """Infer lesion class from filename."""
        filename_lower = filename.lower()

        # Lesion class mapping
        lesion_map = {
            'melanoma': 'MEL',
            'basal': 'BCC',
            'squamous': 'SCC',
            'actinic': 'AKIEC',
            'nevus': 'NV',
            'dermatofibroma': 'DF',
        }

        for keyword, lesion_class in lesion_map.items():
            if keyword in filename_lower:
                return lesion_class

        return None

    def upload_file(self, file_path: str, content: bytes, content_type: str = None) -> bool:
        """
        Upload a file to Supabase Storage.

        Args:
            file_path: Destination path in the bucket
            content: File content as bytes
            content_type: MIME type of the file

        Returns:
            True if successful, False otherwise
        """
        try:
            options = {}
            if content_type:
                options['content-type'] = content_type

            self.client.storage.from_(self.bucket_name).upload(
                file_path,
                content,
                file_options=options
            )
            return True
        except Exception as e:
            print(f"Error uploading file {file_path}: {e}")
            return False

    def delete_file(self, file_path: str) -> bool:
        """
        Delete a file from Supabase Storage.

        Args:
            file_path: Path to the file in the bucket

        Returns:
            True if successful, False otherwise
        """
        try:
            self.client.storage.from_(self.bucket_name).remove([file_path])
            return True
        except Exception as e:
            print(f"Error deleting file {file_path}: {e}")
            return False


# Convenience functions
def get_storage_loader() -> SupabaseStorageLoader:
    """Get a Supabase Storage loader instance."""
    return SupabaseStorageLoader()


def list_all_documents() -> List[Dict]:
    """List all documents in Supabase Storage."""
    loader = get_storage_loader()
    return loader.list_all_files_recursive(file_extensions=['.pdf', '.txt', '.md'])


def load_document_text(file_path: str) -> Optional[str]:
    """Load text content from a document in Supabase Storage."""
    loader = get_storage_loader()
    return loader.extract_text(file_path)


def load_all_documents_with_text() -> List[Dict[str, str]]:
    """Load all documents with their text content."""
    loader = get_storage_loader()
    return loader.get_all_documents()
