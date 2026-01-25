#!/bin/bash

# MIDAS - Start Backend and Frontend Services
# This script runs the backend services and frontend in the background

echo "🚀 Starting MIDAS Services..."
echo "================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Resolve project root
ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"

# Load environment variables from a file if it exists
load_env_file() {
    local env_file="$1"
    if [ -f "$env_file" ]; then
        set -a
        # shellcheck disable=SC1090
        source "$env_file"
        set +a
    fi
}

# Load root env first for shared settings
load_env_file "${ROOT_DIR}/.env"

# Backend services to start: app_path|port|log_file|label
BACKEND_SERVICES=(
    "app.main_agent:app|8000|backend_agent.log|Agent API (Agentic RAG)"
    "app.document_processing:app|8001|backend_doc.log|Doc Processing API"
)

# Kill any existing processes on backend ports and frontend port
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
for service in "${BACKEND_SERVICES[@]}"; do
    IFS='|' read -r _backend_app _backend_port _backend_log _backend_label <<< "$service"
    lsof -ti:"${_backend_port}" | xargs kill -9 2>/dev/null || true
done
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Backend Services
echo -e "\n${BLUE}Starting Backend Services...${NC}"
cd "${ROOT_DIR}/backend"
source venv/bin/activate
# Load backend env, then reload root env to keep shared settings authoritative
load_env_file "${ROOT_DIR}/backend/.env"
load_env_file "${ROOT_DIR}/.env"

BACKEND_PIDS=()
for service in "${BACKEND_SERVICES[@]}"; do
    IFS='|' read -r backend_app backend_port backend_log backend_label <<< "$service"
    nohup python -m uvicorn "${backend_app}" --host 0.0.0.0 --port "${backend_port}" > "${backend_log}" 2>&1 &
    backend_pid=$!
    BACKEND_PIDS+=("${backend_pid}")
    echo "  ✅ ${backend_label} PID: ${backend_pid}"
    echo "  📋 Logs: backend/${backend_log}"
done
cd ..

# Wait for backend services to start
echo -e "\n${YELLOW}Waiting for backend to initialize...${NC}"
sleep 3

# Check if backend services are running
for service in "${BACKEND_SERVICES[@]}"; do
    IFS='|' read -r _backend_app backend_port _backend_log backend_label <<< "$service"
    if curl -s "http://localhost:${backend_port}/api/v1/health" > /dev/null; then
        echo -e "${GREEN}  ✅ ${backend_label} is running on ${backend_port}!${NC}"
    else
        echo -e "${YELLOW}  ⚠️  ${backend_label} may still be initializing on ${backend_port}...${NC}"
    fi
done

# Start Frontend
echo -e "\n${BLUE}Starting Frontend (Port 3000)...${NC}"
cd "${ROOT_DIR}/frontend"
# Load root env first, then .env.local overrides
load_env_file "${ROOT_DIR}/.env"
load_env_file "${ROOT_DIR}/frontend/.env.local"
nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  ✅ Frontend PID: $FRONTEND_PID"
echo "  📋 Logs: frontend/frontend.log"
cd ..

# Wait for frontend to start
echo -e "\n${YELLOW}Waiting for frontend to initialize...${NC}"
sleep 5

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}✅ MIDAS Services Started!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "Backend APIs:"
echo -e "  Agent API:  ${BLUE}http://localhost:8000${NC}"
echo -e "    Docs:     ${BLUE}http://localhost:8000/docs${NC}"
echo -e "    Health:   ${BLUE}http://localhost:8000/api/v1/health${NC}"
echo -e "    Image:    ${BLUE}http://localhost:8000/api/v1/image/health${NC}"
echo -e "    Reports:  ${BLUE}http://localhost:8000/api/v1/reports/health${NC}"
echo -e "  RAG API:    ${BLUE}http://localhost:8001${NC}"
echo -e "    Docs:     ${BLUE}http://localhost:8001/docs${NC}"
echo -e "    Health:   ${BLUE}http://localhost:8001/api/v1/health${NC}"
echo -e "  Simple API: ${BLUE}http://localhost:8002${NC}"
echo -e "    Docs:     ${BLUE}http://localhost:8002/docs${NC}"
echo -e "    Health:   ${BLUE}http://localhost:8002/api/v1/health${NC}"
echo ""
echo -e "Frontend:     ${BLUE}http://localhost:3000${NC}"
echo -e "  Assistant:  ${BLUE}http://localhost:3000/dashboard/assistant${NC}"
echo ""
echo -e "Process IDs:"
for idx in "${!BACKEND_SERVICES[@]}"; do
    IFS='|' read -r _backend_app _backend_port _backend_log backend_label <<< "${BACKEND_SERVICES[$idx]}"
    echo -e "  ${backend_label}: ${BACKEND_PIDS[$idx]}"
done
echo -e "  Frontend:   ${FRONTEND_PID}"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  Backend:    tail -f backend/backend_agent.log"
echo -e "             tail -f backend/backend_main.log"
echo -e "             tail -f backend/backend_simple.log"
echo -e "  Frontend:   tail -f frontend/frontend.log"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo -e "  Run: ./stop-services.sh"
echo ""
echo "================================"
