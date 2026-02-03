#!/usr/bin/env bash
set -euo pipefail

: "${PORT:=8000}"
: "${WORKERS:=1}"

# Optional: log effective config
echo "Starting MIDAS Agent API..."
echo "  PORT=${PORT}"
echo "  WORKERS=${WORKERS}"

# IMPORTANT: single required backend service
exec uvicorn app.main_agent:app \
  --host 0.0.0.0 \
  --port "${PORT}" \
  --workers "${WORKERS}" \
  --timeout-keep-alive 75
