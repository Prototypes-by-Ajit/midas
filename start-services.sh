#!/bin/bash

# MIDAS - Start Both Backend and Frontend Services
# This script runs the backend and frontend in the background

echo "🚀 Starting MIDAS Services..."
echo "================================"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kill any existing processes on ports 8000 and 3000
echo -e "${YELLOW}Cleaning up existing processes...${NC}"
lsof -ti:8000 | xargs kill -9 2>/dev/null || true
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
sleep 2

# Start Backend
echo -e "\n${BLUE}Starting Backend API (Port 8000)...${NC}"
cd backend
source venv/bin/activate
# Load environment variables from .env
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi
nohup python -m uvicorn app.main_agent:app --host 0.0.0.0 --port 8000 > backend.log 2>&1 &
BACKEND_PID=$!
echo "  ✅ Backend PID: $BACKEND_PID"
echo "  📋 Logs: backend/backend.log"
cd ..

# Wait for backend to start
echo -e "\n${YELLOW}Waiting for backend to initialize...${NC}"
sleep 3

# Check if backend is running
if curl -s http://localhost:8000/api/v1/health > /dev/null; then
    echo -e "${GREEN}  ✅ Backend is running!${NC}"
else
    echo -e "${YELLOW}  ⚠️  Backend may still be initializing...${NC}"
fi

# Start Frontend
echo -e "\n${BLUE}Starting Frontend (Port 3000)...${NC}"
cd frontend
# Load environment variables from .env.local
if [ -f .env.local ]; then
    export $(grep -v '^#' .env.local | xargs)
fi
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
echo -e "Backend API:  ${BLUE}http://localhost:8000${NC}"
echo -e "  Docs:       ${BLUE}http://localhost:8000/docs${NC}"
echo -e "  Health:     ${BLUE}http://localhost:8000/api/v1/health${NC}"
echo ""
echo -e "Frontend:     ${BLUE}http://localhost:3000${NC}"
echo -e "  Assistant:  ${BLUE}http://localhost:3000/dashboard/assistant${NC}"
echo ""
echo -e "Process IDs:"
echo -e "  Backend:    ${BACKEND_PID}"
echo -e "  Frontend:   ${FRONTEND_PID}"
echo ""
echo -e "${YELLOW}To view logs:${NC}"
echo -e "  Backend:    tail -f backend/backend.log"
echo -e "  Frontend:   tail -f frontend/frontend.log"
echo ""
echo -e "${YELLOW}To stop services:${NC}"
echo -e "  Run: ./stop-services.sh"
echo ""
echo "================================"
