#!/bin/bash

echo "🔍 Testing Conversations API Endpoint"
echo "=========================================="
echo ""

# Test with cookies (simulating authenticated browser request)
echo "1. Testing GET /api/conversations (will likely return 401)..."
echo "Making request to: http://localhost:3000/api/conversations"
echo ""

# Capture full response including headers
RESPONSE=$(curl -v -s http://localhost:3000/api/conversations 2>&1)

echo "Full Response:"
echo "$RESPONSE"
echo ""
echo "=========================================="
echo ""

# Try to extract just the body
BODY=$(echo "$RESPONSE" | grep -A 1000 "^{" | grep -B 1000 "^}")

echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Check if it's an empty object
if [ "$BODY" = "{}" ]; then
    echo "⚠️  WARNING: Response is an empty object {}"
    echo "This suggests the API route is returning 200 OK with empty body"
else
    echo "✅ Response contains data"
fi
echo ""

# Test POST endpoint
echo "2. Testing POST /api/conversations (create new conversation)..."
echo ""
curl -v -X POST http://localhost:3000/api/conversations 2>&1 | tail -20
echo ""
