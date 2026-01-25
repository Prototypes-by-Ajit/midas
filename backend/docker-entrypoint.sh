#!/bin/sh
set -e

echo "🚀 Starting MIDAS Multi-Agent Backend Services..."
echo "================================================="

# Start Agentic RAG System (Main Agent API)
echo "📡 Starting Agentic RAG System (Main Agent API) on port 8000..."
echo "   - Router Agent"
echo "   - RAG Agent"
echo "   - Web Scraping Agent"
echo "   - Image Analysis"
uvicorn app.main_agent:app --host 0.0.0.0 --port 8000 --workers 1 &

# Start Document Processing API
echo ""
echo "📄 Starting Document Processing API on port 8001..."
echo "   - PDF Upload & Processing"
echo "   - Vector Embeddings"
uvicorn app.document_processing:app --host 0.0.0.0 --port 8001 --workers 1 &

echo ""
echo "✅ All Agentic RAG services started!"
echo "================================================="

# Wait for all background processes
wait
