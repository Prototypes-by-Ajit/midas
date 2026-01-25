#!/bin/bash

echo "🔍 MIDAS Services Health Check"
echo "========================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test Backend
echo "1️⃣  Testing Backend (http://localhost:8000)..."
BACKEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/v1/health 2>/dev/null)

if [ "$BACKEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Backend is running${NC}"
    echo "   URL: http://localhost:8000"
    echo "   Health: $(curl -s http://localhost:8000/api/v1/health | jq -r '.status // "healthy"' 2>/dev/null || echo 'OK')"
else
    echo -e "${RED}❌ Backend is NOT running or unreachable${NC}"
    echo "   Expected: http://localhost:8000/api/v1/health"
    echo "   Status code: ${BACKEND_HEALTH:-'N/A'}"
    echo ""
    echo "   To start backend:"
    echo "   cd backend"
    echo "   python -m app.main_agent"
fi
echo ""

# Test Frontend
echo "2️⃣  Testing Frontend (http://localhost:3000)..."
FRONTEND_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health 2>/dev/null)

if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Frontend is running${NC}"
    echo "   URL: http://localhost:3000"
    echo "   Health: $(curl -s http://localhost:3000/api/health | jq -r '.status // "ok"' 2>/dev/null || echo 'OK')"
else
    echo -e "${RED}❌ Frontend is NOT running or unreachable${NC}"
    echo "   Expected: http://localhost:3000/api/health"
    echo "   Status code: ${FRONTEND_HEALTH:-'N/A'}"
    echo ""
    echo "   To start frontend:"
    echo "   cd frontend"
    echo "   npm run dev"
fi
echo ""

# Test Frontend → Backend connectivity
echo "3️⃣  Testing Frontend → Backend connectivity..."
if [ "$FRONTEND_HEALTH" = "200" ]; then
    echo "   Checking if frontend can reach backend..."
    # This tests the Next.js API route which should call the backend
    CONVERSATIONS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/conversations 2>/dev/null)

    if [ "$CONVERSATIONS" = "401" ]; then
        echo -e "${GREEN}✅ Frontend API routes working (401 = needs auth, expected)${NC}"
    elif [ "$CONVERSATIONS" = "200" ]; then
        echo -e "${GREEN}✅ Frontend → Backend connection working${NC}"
    else
        echo -e "${YELLOW}⚠️  Frontend API returned: ${CONVERSATIONS}${NC}"
        echo "   This might be normal (requires authentication)"
    fi
else
    echo -e "${YELLOW}⚠️  Skipped (frontend not running)${NC}"
fi
echo ""

# Summary
echo "========================================"
echo "📊 Summary:"
echo ""

if [ "$BACKEND_HEALTH" = "200" ] && [ "$FRONTEND_HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ All services are running!${NC}"
    echo ""
    echo "Next steps:"
    echo "  1. Open http://localhost:3000 in your browser"
    echo "  2. Sign in with Clerk"
    echo "  3. Try sending a chat message"
    echo ""
    echo "To view logs:"
    echo "  - Backend logs: Check terminal running 'python -m app.main_agent'"
    echo "  - Frontend logs: Check terminal running 'npm run dev'"
    echo "  - Browser logs: Press F12 → Console tab"
else
    echo -e "${RED}❌ Some services are not running${NC}"
    echo ""
    echo "Required services:"
    echo "  - Backend:  $([ "$BACKEND_HEALTH" = "200" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}") http://localhost:8000"
    echo "  - Frontend: $([ "$FRONTEND_HEALTH" = "200" ] && echo -e "${GREEN}✅${NC}" || echo -e "${RED}❌${NC}") http://localhost:3000"
fi
echo ""
