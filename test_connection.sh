#!/bin/bash
set -e

echo "🔍 Testing Backend-Frontend Connection"
echo "========================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if backend is running
echo "1️⃣  Checking Backend Health..."
if curl -s http://localhost:8001/healthz > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend liveness OK${NC}"
else
    echo -e "${RED}✗ Backend not responding on localhost:8001${NC}"
    echo "   Run: ./scripts/up.sh"
    exit 1
fi

# Check readiness
if curl -s http://localhost:8001/readyz > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend readiness OK${NC}"
    curl -s http://localhost:8001/readyz | jq '.'
else
    echo -e "${YELLOW}⚠ Backend readiness check failed${NC}"
fi

echo ""
echo "2️⃣  Checking Backend API Health..."
if curl -s http://localhost:8001/api/v1/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API OK${NC}"
    curl -s http://localhost:8001/api/v1/health | jq '.status, .components'
else
    echo -e "${RED}✗ Backend API not responding${NC}"
    exit 1
fi

echo ""
echo "3️⃣  Checking Frontend..."
if curl -s http://localhost:3000 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is running${NC}"
else
    echo -e "${RED}✗ Frontend not responding on localhost:3000${NC}"
    exit 1
fi

echo ""
echo "4️⃣  Environment Variables Check..."
if [ -f ".env.frontend" ]; then
    echo -e "${GREEN}✓ .env.frontend exists${NC}"
    if grep -q "BACKEND_URL=http://localhost:8001" .env.frontend; then
        echo -e "${GREEN}✓ BACKEND_URL configured correctly${NC}"
    else
        echo -e "${YELLOW}⚠ BACKEND_URL not set or incorrect${NC}"
    fi
else
    echo -e "${RED}✗ .env.frontend not found${NC}"
fi

if [ -f ".env.backend" ]; then
    echo -e "${GREEN}✓ .env.backend exists${NC}"
else
    echo -e "${RED}✗ .env.backend not found${NC}"
fi

echo ""
echo "5️⃣  Testing Backend Session Creation..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/sessions)
if echo "$SESSION_RESPONSE" | jq -e '.session_id' > /dev/null 2>&1; then
    SESSION_ID=$(echo "$SESSION_RESPONSE" | jq -r '.session_id')
    echo -e "${GREEN}✓ Session created: $SESSION_ID${NC}"
    
    echo ""
    echo "6️⃣  Testing Backend Message Send..."
    MESSAGE_RESPONSE=$(curl -s -X POST http://localhost:8001/api/v1/sessions/$SESSION_ID/messages \
        -H "Content-Type: application/json" \
        -d '{"query": "What is melanoma?", "user_id": "test_user"}')
    
    if echo "$MESSAGE_RESPONSE" | jq -e '.answer' > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Backend processed message successfully${NC}"
        echo "   Answer: $(echo "$MESSAGE_RESPONSE" | jq -r '.answer' | head -c 100)..."
    else
        echo -e "${RED}✗ Backend failed to process message${NC}"
        echo "$MESSAGE_RESPONSE" | jq '.'
    fi
else
    echo -e "${RED}✗ Failed to create session${NC}"
    echo "$SESSION_RESPONSE"
fi

echo ""
echo "========================================"
echo -e "${GREEN}✅ Connection test complete!${NC}"
echo ""
echo "Next steps:"
echo "  1. Open http://localhost:3000 in your browser"
echo "  2. Login with Clerk"
echo "  3. Navigate to AI Assistant"
echo "  4. Send a test message"
echo "  5. Monitor logs: ./scripts/logs.sh"
