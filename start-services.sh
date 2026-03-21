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
BACKEND_LISTEN_HOST="127.0.0.1"
BACKEND_LISTEN_PORT="8000"
BACKEND_PUBLIC_URL="http://${BACKEND_LISTEN_HOST}:${BACKEND_LISTEN_PORT}"

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

ensure_frontend_deps() {
    local frontend_dir="$1"
    local clerk_auth_file="${frontend_dir}/node_modules/@clerk/nextjs/dist/esm/server/data/getAuthDataFromRequest.js"

    if [ ! -d "${frontend_dir}/node_modules" ]; then
        echo -e "${YELLOW}  ⚠️  Frontend node_modules missing. Running npm ci...${NC}"
        (cd "${frontend_dir}" && npm ci) || exit 1
        return
    fi

    if ! (cd "${frontend_dir}" && node -e "require('@tanstack/react-query/package.json'); require('@tanstack/query-core/package.json')") >/dev/null 2>&1; then
        echo -e "${YELLOW}  ⚠️  Frontend dependencies are inconsistent. Reinstalling...${NC}"
        rm -rf "${frontend_dir}/node_modules"
        (cd "${frontend_dir}" && npm ci) || exit 1
        return
    fi

    if ! (cd "${frontend_dir}" && node -e "const qc=require('@tanstack/query-core'); if (typeof qc.hydrate !== 'function') { process.exit(1); }") >/dev/null 2>&1; then
        echo -e "${YELLOW}  ⚠️  Frontend dependency drift detected (query-core hydrate missing). Reinstalling...${NC}"
        rm -rf "${frontend_dir}/node_modules"
        (cd "${frontend_dir}" && npm ci) || exit 1
        return
    fi

    if [ ! -f "${clerk_auth_file}" ]; then
        echo -e "${YELLOW}  ⚠️  Clerk module cache appears corrupted (missing ${clerk_auth_file}). Reinstalling frontend...${NC}"
        (cd "${frontend_dir}" && npm ci) || exit 1
    fi
}

ensure_backend_env() {
    local backend_dir="$1"
    local venv_dir="${backend_dir}/venv"
    local req_file="${backend_dir}/requirements.txt"
    local deps_marker="${backend_dir}/.deps-installed"

    if [ ! -d "${venv_dir}" ]; then
        if command -v uv >/dev/null 2>&1; then
            echo -e "${YELLOW}  🧰 Creating backend virtual environment with uv...${NC}"
            (cd "${backend_dir}" && uv venv venv)
        else
            echo -e "${YELLOW}  🧰 Creating backend virtual environment with python -m venv...${NC}"
            (cd "${backend_dir}" && python -m venv venv)
        fi
    fi

    # shellcheck disable=SC1091
    source "${venv_dir}/bin/activate"

    if [ ! -f "${req_file}" ]; then
        echo -e "${YELLOW}  ⚠️  requirements file not found at ${req_file}, skipping dependency install.${NC}"
        return
    fi

    if [ -f "${deps_marker}" ] && python -c "import openai" >/dev/null 2>&1; then
        return
    fi

    if command -v uv >/dev/null 2>&1; then
        echo -e "${YELLOW}  🔧 Installing backend dependencies with uv...${NC}"
        if ! (cd "${backend_dir}" && uv pip install -r requirements.txt); then
            echo -e "${YELLOW}  ⚠️  uv install failed, falling back to pip...${NC}"
            (cd "${backend_dir}" && python -m pip install -r requirements.txt)
        fi
    else
        echo -e "${YELLOW}  🔧 Installing backend dependencies with pip...${NC}"
        (cd "${backend_dir}" && python -m pip install -r requirements.txt)
    fi

    if ! python -c "import openai" >/dev/null 2>&1; then
        echo -e "${YELLOW}  ❌ Backend dependencies not installed correctly (openai missing).${NC}"
        echo -e "${YELLOW}     Fix: cd backend && source venv/bin/activate && python -m pip install -r requirements.txt${NC}"
        exit 1
    fi

    touch "${deps_marker}"
}

# Load root env first for shared settings
load_env_file "${ROOT_DIR}/.env"
load_env_file "${ROOT_DIR}/.env.backend"

# Backend services to start: app_path|port|log_file|label
BACKEND_SERVICES=(
    "app.main_agent:app|${BACKEND_LISTEN_PORT}|backend_agent.log|Agent API (Agentic RAG)"
)
BACKEND_HEALTH_TIMEOUT_SECONDS=60
BACKEND_HEALTH_RETRY_SECONDS=2
FRONTEND_HEALTH_TIMEOUT_SECONDS=90
FRONTEND_HEALTH_RETRY_SECONDS=3

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
ensure_backend_env "${ROOT_DIR}/backend"
cd "${ROOT_DIR}/backend"
source venv/bin/activate

# Load backend env, then reload project-level env files so local overrides remain effective.
load_env_file "${ROOT_DIR}/backend/.env"
load_env_file "${ROOT_DIR}/backend/.env.backend"
load_env_file "${ROOT_DIR}/.env.backend"
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

# Check if backend services are running
BACKEND_FAILED=0
idx=0
for service in "${BACKEND_SERVICES[@]}"; do
    IFS='|' read -r _backend_app backend_port _backend_log backend_label <<< "$service"
    backend_pid="${BACKEND_PIDS[$idx]}"
    waited=0

    while [ "$waited" -lt "$BACKEND_HEALTH_TIMEOUT_SECONDS" ]; do
        if ! kill -0 "$backend_pid" 2>/dev/null; then
            BACKEND_FAILED=1
            echo -e "${YELLOW}  ⚠️  ${backend_label} exited before becoming healthy.${NC}"
            echo -e "${YELLOW}     Last 120 lines from backend/${_backend_log}:${NC}"
            tail -n 120 "backend/${_backend_log}" || true
            break
        fi

        if curl -s "http://127.0.0.1:${backend_port}/healthz" > /dev/null; then
            echo -e "${GREEN}  ✅ ${backend_label} is running on ${backend_port}!${NC}"
            break
        elif curl -s "http://127.0.0.1:${backend_port}/api/v1/health" > /dev/null; then
            echo -e "${GREEN}  ✅ ${backend_label} is running on ${backend_port} (via /api/v1/health)!${NC}"
            break
        fi

        sleep "$BACKEND_HEALTH_RETRY_SECONDS"
        waited=$((waited + BACKEND_HEALTH_RETRY_SECONDS))
    done

    if [ "$waited" -ge "$BACKEND_HEALTH_TIMEOUT_SECONDS" ]; then
        BACKEND_FAILED=1
        echo -e "${YELLOW}  ⚠️  ${backend_label} failed health check after ${BACKEND_HEALTH_TIMEOUT_SECONDS}s on ${backend_port}.${NC}"
        echo -e "${YELLOW}     Last 120 lines from backend/${_backend_log}:${NC}"
        tail -n 120 "backend/${_backend_log}" || true
    fi
    idx=$((idx + 1))
done

if [ "${BACKEND_FAILED}" -eq 1 ]; then
    echo -e "\n${YELLOW}Backend did not start correctly. Fix backend errors above and rerun ./start-services.sh${NC}"
    exit 1
fi

# Start Frontend
echo -e "\n${BLUE}Starting Frontend (Port 3000)...${NC}"
cd "${ROOT_DIR}/frontend"
# Load root env first, then .env.local overrides
load_env_file "${ROOT_DIR}/.env"
load_env_file "${ROOT_DIR}/frontend/.env.local"

ensure_frontend_deps "${ROOT_DIR}/frontend"
rm -rf .next

env \
    BACKEND_URL="${BACKEND_PUBLIC_URL}" \
    NEXT_PUBLIC_BACKEND_URL="${BACKEND_PUBLIC_URL}" \
    NEXT_PUBLIC_API_URL="${BACKEND_PUBLIC_URL}" \
    nohup npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!
echo "  ✅ Frontend PID: $FRONTEND_PID"
echo "  📋 Logs: frontend/frontend.log"
cd ..

# Wait for frontend to start
echo -e "\n${YELLOW}Waiting for frontend to initialize...${NC}"
front_waited=0
while [ "$front_waited" -lt "$FRONTEND_HEALTH_TIMEOUT_SECONDS" ]; do
    if ! kill -0 "${FRONTEND_PID}" 2>/dev/null; then
        echo -e "${YELLOW}  ⚠️  Frontend process exited before becoming ready.${NC}"
        echo -e "${YELLOW}     Last 120 lines from frontend/frontend.log:${NC}"
        tail -n 120 frontend/frontend.log || true
        exit 1
    fi

    if curl -s "http://127.0.0.1:3000/" > /dev/null; then
        echo -e "${GREEN}  ✅ Frontend is running on http://localhost:3000${NC}"
        break
    fi

    sleep "$FRONTEND_HEALTH_RETRY_SECONDS"
    front_waited=$((front_waited + FRONTEND_HEALTH_RETRY_SECONDS))
done

if [ "$front_waited" -ge "$FRONTEND_HEALTH_TIMEOUT_SECONDS" ]; then
    echo -e "${YELLOW}  ⚠️  Frontend failed to respond after ${FRONTEND_HEALTH_TIMEOUT_SECONDS}s on port 3000.${NC}"
    echo -e "${YELLOW}     Last 120 lines from frontend/frontend.log:${NC}"
    tail -n 120 frontend/frontend.log || true
    exit 1
fi

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
echo -e "  Frontend:   tail -f frontend/frontend.log"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo -e "  Run: ./stop-services.sh"
echo ""
echo "================================"
