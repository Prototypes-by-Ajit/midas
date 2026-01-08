#!/bin/bash
# ============================================================================
# MIDAS Full Agent Mode - Service Startup Script
# ============================================================================

echo "🚀 Starting MIDAS Full Agent Mode Services..."
echo "================================================"

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Kill any existing services
echo -e "${YELLOW}Stopping any existing services...${NC}"
pkill -f "uvicorn.*main" 2>/dev/null
pkill -f "next dev" 2>/dev/null
sleep 2

# Start Backend (Agent Mode)
echo -e "\n${GREEN}Starting Backend (Full Agent Mode)...${NC}"
cd backend
python -m uvicorn app.main_agent:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"
sleep 3

# Start Frontend
echo -e "\n${GREEN}Starting Frontend...${NC}"
cd ../frontend
npm run dev &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"
sleep 3

# Display status
echo -e "\n================================================"
echo -e "${GREEN}✅ Services Started Successfully!${NC}"
echo "================================================"
echo ""
echo "📊 Service Status:"
echo "  Backend (Agent):  http://localhost:8000"
echo "  Backend Docs:     http://localhost:8000/docs"
echo "  Frontend:         http://localhost:3000"
echo ""
echo "  Backend PID:      $BACKEND_PID"
echo "  Frontend PID:     $FRONTEND_PID"
echo ""
echo "💡 To stop services:"
echo "   ./stop-services.sh"
echo ""
echo "📝 Logs:"
echo "   Backend:  tail -f backend/logs (if configured)"
echo "   Frontend: In this terminal"
echo ""
echo "Press Ctrl+C to stop all services"
echo ""

# Wait for both processes
wait
