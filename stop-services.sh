#!/bin/bash

# MIDAS - Stop Both Backend and Frontend Services

echo "🛑 Stopping MIDAS Services..."
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Kill processes on port 8000 (Backend)
echo -e "\n${RED}Stopping Backend (Port 8000)...${NC}"
BACKEND_PIDS=$(lsof -ti:8000)
if [ -n "$BACKEND_PIDS" ]; then
    echo "$BACKEND_PIDS" | xargs kill -9 2>/dev/null
    echo -e "${GREEN}  ✅ Backend stopped${NC}"
else
    echo "  ℹ️  No backend process found"
fi

# Kill processes on port 3000 (Frontend)
echo -e "\n${RED}Stopping Frontend (Port 3000)...${NC}"
FRONTEND_PIDS=$(lsof -ti:3000)
if [ -n "$FRONTEND_PIDS" ]; then
    echo "$FRONTEND_PIDS" | xargs kill -9 2>/dev/null
    echo -e "${GREEN}  ✅ Frontend stopped${NC}"
else
    echo "  ℹ️  No frontend process found"
fi

# Also kill any Node.js processes that might be Next.js dev server
echo -e "\n${RED}Cleaning up any remaining processes...${NC}"
pkill -f "next dev" 2>/dev/null || true
pkill -f "uvicorn" 2>/dev/null || true

echo -e "\n${GREEN}================================${NC}"
echo -e "${GREEN}✅ All services stopped!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
