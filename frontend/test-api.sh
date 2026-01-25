#!/bin/bash

echo "🔍 Testing MIDAS Frontend API Endpoints"
echo "========================================"
echo ""

# Test health endpoint
echo "1. Testing Health Endpoint..."
curl -s http://localhost:3000/api/health | jq '.' || echo "Failed - Is frontend running?"
echo ""

# Test conversations endpoint (requires auth, will likely return 401)
echo "2. Testing Conversations Endpoint..."
curl -s http://localhost:3000/api/conversations | jq '.' || echo "Expected 401 (requires authentication)"
echo ""

echo "✅ Tests complete!"
echo ""
echo "Next steps:"
echo "  1. Check terminal where 'npm run dev' is running for server logs"
echo "  2. Check browser console for detailed error logs"
echo "  3. Make sure you're signed in with Clerk"
