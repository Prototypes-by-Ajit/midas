"""
API endpoints for document processing triggered by Edge Functions.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import base64
import io
from typing import Optional
import PyPDF2

from app.services.supabase_vector_store import supabase_vector_store
from app.services.embeddings import embedding_service
from app.indexing.rag_chunk_index import rag_chunk_index

router = APIRouter()


class ExtractTextRequest(BaseModel):
    """Request model for text extraction."""
    document_id: str
    file_data: str  # Base64 encoded file
    file_type: str  # pdf, txt, md


class ProcessDocumentRequest(BaseModel):
    """Request model for document processing."""
    document_id: str
    content: str
    lesion_class: Optional[str] = None


class ProcessFromStorageRequest(BaseModel):
    """Request model for processing document from Supabase storage."""
    document_id: str
    storage_path: str
    bucket: str = "Multiagent_Skincancer_RAG"


class ExtractTextResponse(BaseModel):
    """Response model for text extraction."""
    text: str
    document_id: str
    length: int


class ProcessDocumentResponse(BaseModel):
    """Response model for document processing."""
    success: bool
    document_id: str
    embeddings_created: int
    status: str


@router.post("/extract-text", response_model=ExtractTextResponse)
async def extract_text(request: ExtractTextRequest):
    """
    Extract text from a base64-encoded file.
    Called by Edge Function for PDF text extraction.
    """
    try:
        # Decode base64 file
        file_bytes = base64.b64decode(request.file_data)

        extracted_text = ""

        if request.file_type == "pdf":
            # Extract text from PDF
            pdf_file = io.BytesIO(file_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            for page in pdf_reader.pages:
                extracted_text += page.extract_text() + "\n"

            extracted_text = extracted_text.strip()

        elif request.file_type in ["txt", "md"]:
            # Decode text file
            extracted_text = file_bytes.decode('utf-8')
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {request.file_type}"
            )

        if not extracted_text:
            raise HTTPException(
                status_code=400,
                detail="No text could be extracted from the file"
            )

        return ExtractTextResponse(
            text=extracted_text,
            document_id=request.document_id,
            length=len(extracted_text)
        )

    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Failed to extract text: {str(e)}"
        )


@router.post("/process-document", response_model=ProcessDocumentResponse)
async def process_document(request: ProcessDocumentRequest):
    """
    Process a document by creating embeddings and storing in vector database.
    Called by Edge Function after text extraction.
    """
    try:
        print(f"Processing document: {request.document_id}")
        print(f"Content length: {len(request.content)} characters")

        # Ensure embedding model is loaded
        if not embedding_service.model:
            print("Loading embedding model...")
            embedding_service.load_model()

        # Ensure Supabase vector store is initialized
        if not supabase_vector_store.is_ready():
            print("Initializing Supabase vector store...")
            supabase_vector_store.initialize()

        # Get document metadata for B+ tree indexing
        doc_result = supabase_vector_store.client.table('documents').select('title, source, lesion_class').eq('id', request.document_id).execute()
        doc_meta = doc_result.data[0] if doc_result.data else {}
        
        # Index document in B+ tree for efficient chunk retrieval
        print("🌳 Indexing document in B+ tree...")
        chunk_metas = rag_chunk_index.index_document(
            tenant_id="default",
            doc_id=request.document_id,
            text=request.content,
            chunk_size=500,  # Match chunk_size used for embeddings
            overlap=100,  # Overlap for context continuity
            lesion_class=doc_meta.get('lesion_class'),
            source=doc_meta.get('source', 'unknown')
        )
        print(f"   Indexed {len(chunk_metas)} chunks in B+ tree")
        
        # Chunk the text and create embeddings
        print("Creating embeddings...")
        chunks = supabase_vector_store._chunk_text(request.content, chunk_size=500)

        embeddings_created = 0
        for i, chunk in enumerate(chunks):
            # Generate embedding
            embedding = embedding_service.embed_text(chunk)

            # Store in embeddings table
            await supabase_vector_store._store_embedding(
                document_id=request.document_id,
                chunk_text=chunk,
                chunk_index=i,
                embedding=embedding,
                chunk_size=len(chunk)
            )
            embeddings_created += 1

        # Update document status to 'processed'
        supabase_vector_store.client.table('documents').update({
            'status': 'processed'
        }).eq('id', request.document_id).execute()

        print(f"Created {embeddings_created} embeddings for document {request.document_id}")

        return ProcessDocumentResponse(
            success=True,
            document_id=request.document_id,
            embeddings_created=embeddings_created,
            status="processed"
        )

    except Exception as e:
        print(f"Error processing document: {str(e)}")

        # Update document status to 'failed'
        try:
            supabase_vector_store.client.table('documents').update({
                'status': 'failed'
            }).eq('id', request.document_id).execute()
        except:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to process document: {str(e)}"
        )


@router.post("/process-from-storage", response_model=ProcessDocumentResponse)
async def process_from_storage(request: ProcessFromStorageRequest):
    """
    Download document from Supabase Storage, extract text, and create embeddings.
    This is the complete pipeline for local development.
    """
    try:
        print(f"📥 Downloading document {request.document_id} from storage...")
        print(f"   Storage path: {request.storage_path}")
        print(f"   Bucket: {request.bucket}")

        # Download file from Supabase Storage
        response = supabase_vector_store.client.storage.from_(request.bucket).download(request.storage_path)

        if not response:
            raise HTTPException(
                status_code=404,
                detail=f"File not found in storage: {request.storage_path}"
            )

        file_bytes = response
        file_ext = request.storage_path.split('.')[-1].lower()

        print(f"✅ Downloaded {len(file_bytes)} bytes, file type: {file_ext}")

        # Extract text based on file type
        extracted_text = ""

        if file_ext == "pdf":
            pdf_file = io.BytesIO(file_bytes)
            pdf_reader = PyPDF2.PdfReader(pdf_file)

            print(f"📄 Extracting text from {len(pdf_reader.pages)} pages...")
            for page_num, page in enumerate(pdf_reader.pages):
                text = page.extract_text()
                extracted_text += text + "\n"
                if (page_num + 1) % 10 == 0:
                    print(f"   Processed {page_num + 1}/{len(pdf_reader.pages)} pages...")

            extracted_text = extracted_text.strip()

        elif file_ext in ["txt", "md"]:
            extracted_text = file_bytes.decode('utf-8')
        else:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type: {file_ext}"
            )

        if not extracted_text or len(extracted_text) < 50:
            raise HTTPException(
                status_code=400,
                detail="No meaningful text could be extracted from the file"
            )

        print(f"✅ Extracted {len(extracted_text)} characters")

        # Update document with extracted content
        supabase_vector_store.client.table('documents').update({
            'content': extracted_text[:10000],  # Store first 10k chars in documents table
            'status': 'processing'
        }).eq('id', request.document_id).execute()

        # Ensure embedding model is loaded
        if not embedding_service.model:
            print("🔄 Loading embedding model...")
            embedding_service.load_model()

        # Ensure Supabase vector store is initialized
        if not supabase_vector_store.is_ready():
            print("🔄 Initializing Supabase vector store...")
            supabase_vector_store.initialize()

        # Get document metadata for B+ tree indexing
        doc_result = supabase_vector_store.client.table('documents').select('title, source, lesion_class').eq('id', request.document_id).execute()
        doc_meta = doc_result.data[0] if doc_result.data else {}
        
        # Index document in B+ tree for efficient chunk retrieval
        print("🌳 Indexing document in B+ tree...")
        chunk_metas = rag_chunk_index.index_document(
            tenant_id="default",
            doc_id=request.document_id,
            text=extracted_text,
            chunk_size=500,  # Match chunk_size used for embeddings
            overlap=100,  # Overlap for context continuity
            lesion_class=doc_meta.get('lesion_class'),
            source=doc_meta.get('source', 'unknown')
        )
        print(f"   Indexed {len(chunk_metas)} chunks in B+ tree")
        
        # Chunk the text and create embeddings
        print("🔄 Creating embeddings...")
        chunks = supabase_vector_store._chunk_text(extracted_text, chunk_size=500)
        print(f"   Split into {len(chunks)} chunks")

        embeddings_created = 0
        for i, chunk in enumerate(chunks):
            # Generate embedding
            embedding = embedding_service.embed_text(chunk)

            # Store in embeddings table
            await supabase_vector_store._store_embedding(
                document_id=request.document_id,
                chunk_text=chunk,
                chunk_index=i,
                embedding=embedding,
                chunk_size=len(chunk)
            )
            embeddings_created += 1

            if (i + 1) % 50 == 0:
                print(f"   Created {i + 1}/{len(chunks)} embeddings...")

        # Update document status to 'processed'
        supabase_vector_store.client.table('documents').update({
            'status': 'processed'
        }).eq('id', request.document_id).execute()

        print(f"✅ Successfully processed document {request.document_id}")
        print(f"   Created {embeddings_created} embeddings")

        return ProcessDocumentResponse(
            success=True,
            document_id=request.document_id,
            embeddings_created=embeddings_created,
            status="processed"
        )

    except HTTPException:
        raise
    except Exception as e:
        print(f"❌ Error processing document: {str(e)}")
        import traceback
        traceback.print_exc()

        # Update document status to 'failed'
        try:
            supabase_vector_store.client.table('documents').update({
                'status': 'failed'
            }).eq('id', request.document_id).execute()
        except:
            pass

        raise HTTPException(
            status_code=500,
            detail=f"Failed to process document: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "document-processing",
        "embedding_model_loaded": embedding_service.model is not None,
        "vector_store_ready": supabase_vector_store.is_ready()
    }
