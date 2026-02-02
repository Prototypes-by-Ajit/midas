#!/bin/sh
set -e

# Railway provides PORT env var; default to 8000
PORT="${PORT:-8000}"
WORKERS="${WORKERS:-1}"

echo "Starting MIDAS Multi-Agent Backend..."
echo "================================================="
echo "  Port: $PORT | Workers: $WORKERS"
echo "  Agents: Router, RAG, Web Scraping, Image Analysis"
echo "  Document Processing: included"
echo "================================================="

# Single uvicorn process — document processing is included in main_agent
exec uvicorn app.main_agent:app \
    --host 0.0.0.0 \
    --port "$PORT" \
    --workers "$WORKERS" \
    --log-level info \
    --timeout-keep-alive 120
