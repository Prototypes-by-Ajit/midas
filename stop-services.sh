#!/bin/bash

# MIDAS - Stop Both Backend and Frontend Services

echo "🛑 Stopping MIDAS Services..."
echo "================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# Kill backend processes on known ports
echo -e "\n${RED}Stopping Backend (Ports 8000, 8001)...${NC}"
for port in 8000 8001; do
    BACKEND_PIDS=$(lsof -ti:${port})
    if [ -n "$BACKEND_PIDS" ]; then
        echo "$BACKEND_PIDS" | xargs kill -9 2>/dev/null
        echo -e "${GREEN}  ✅ Backend stopped on port ${port}${NC}"
    else
        echo "  ℹ️  No backend process found on port ${port}"
    fi
done

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
