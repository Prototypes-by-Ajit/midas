#!/bin/bash

echo "🔍 Testing Document Upload & Indexing Pipeline"
echo "================================================"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BACKEND_URL="http://localhost:8000"
SUPABASE_URL="https://mlacjzlhdmpufxqnmeze.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sYWNqemxoZG1wdWZ4cW5tZXplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcyMzIwNywiZXhwIjoyMDgzMjk5MjA3fQ.kN7Zf3HGR_6Qr6LbxY2144I36KeZeSmLzUQadTjI6_k"

echo "Step 1: Check if backend is running"
echo "-----------------------------------"
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" ${BACKEND_URL}/api/v1/health 2>/dev/null)

if [ "$HEALTH" = "200" ]; then
    echo -e "${GREEN}✅ Backend is running${NC}"
else
    echo -e "${RED}❌ Backend is NOT running (status: ${HEALTH:-N/A})${NC}"
    echo ""
    echo "Please start the backend:"
    echo "  cd backend"
    echo "  python -m app.main_agent"
    exit 1
fi
echo ""

echo "Step 2: Create a test document"
echo "------------------------------"
TEST_FILE="/tmp/test_document_$(date +%s).txt"
cat > "$TEST_FILE" << 'EOF'
# Melanoma Clinical Guidelines

## Overview
Melanoma is the most serious type of skin cancer. It develops in melanocytes, the cells that produce melanin pigment. Early detection and treatment are crucial for positive outcomes.

## Risk Factors
- Family history of melanoma
- Fair skin, light hair, and light eyes
- History of sunburns
- Multiple or atypical moles
- Weakened immune system

## ABCDE Warning Signs
- Asymmetry: One half unlike the other
- Border: Irregular, scalloped, or poorly defined
- Color: Varied from one area to another
- Diameter: Larger than 6mm (pencil eraser)
- Evolving: Changes in size, shape, or color

## Treatment Options
1. Surgical excision
2. Immunotherapy
3. Targeted therapy
4. Radiation therapy
5. Chemotherapy

## Follow-up Care
Regular skin examinations and monitoring are essential for melanoma survivors.
EOF

echo -e "${GREEN}✅ Created test file: $TEST_FILE${NC}"
echo "   File size: $(wc -c < "$TEST_FILE") bytes"
echo "   Content preview:"
head -5 "$TEST_FILE" | sed 's/^/   /'
echo ""

echo "Step 3: Upload file to Supabase Storage"
echo "---------------------------------------"
# Note: We'll simulate this by creating a document record directly
# In production, this would be done through the frontend upload

# Create a document record in Supabase
DOC_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')
STORAGE_PATH="documents/test_${DOC_ID}.txt"

echo "   Document ID: $DOC_ID"
echo "   Storage Path: $STORAGE_PATH"
echo ""

# Insert document record
echo "   Creating document record in Supabase..."
INSERT_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/documents" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"${DOC_ID}\",
    \"title\": \"Test Melanoma Document\",
    \"file_name\": \"test_melanoma.txt\",
    \"content\": $(cat "$TEST_FILE" | jq -Rs .),
    \"storage_path\": \"${STORAGE_PATH}\",
    \"source\": \"upload\",
    \"source_type\": \"file\",
    \"status\": \"pending\"
  }")

if echo "$INSERT_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Document record created${NC}"
else
    echo -e "${RED}❌ Failed to create document record${NC}"
    echo "   Response: $INSERT_RESPONSE"
    exit 1
fi
echo ""

echo "Step 4: Trigger document processing (B+ tree + embeddings)"
echo "----------------------------------------------------------"
echo "   Calling: ${BACKEND_URL}/api/v1/documents/${DOC_ID}/process"

PROCESS_RESPONSE=$(curl -s -X POST \
  "${BACKEND_URL}/api/v1/documents/${DOC_ID}/process" \
  -H "Content-Type: application/json" \
  -d "{\"document_id\": \"${DOC_ID}\"}")

echo "   Response:"
echo "$PROCESS_RESPONSE" | jq '.' 2>/dev/null || echo "$PROCESS_RESPONSE"
echo ""

# Check if processing succeeded
if echo "$PROCESS_RESPONSE" | jq -e '.success' > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Document processing initiated${NC}"
else
    echo -e "${RED}❌ Document processing failed${NC}"
    echo ""
    echo "Common issues:"
    echo "  1. Backend not running or not accessible"
    echo "  2. Embedding service not initialized"
    echo "  3. Supabase connection issues"
    echo "  4. B+ tree indexing failed"
    exit 1
fi
echo ""

echo "Step 5: Wait for processing to complete"
echo "---------------------------------------"
echo "   Waiting 3 seconds..."
sleep 3

# Check document status
echo "   Checking document status..."
STATUS_RESPONSE=$(curl -s \
  "${SUPABASE_URL}/rest/v1/documents?id=eq.${DOC_ID}&select=status,title" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.[0].status // "unknown"')

if [ "$STATUS" = "processed" ]; then
    echo -e "${GREEN}✅ Document status: processed${NC}"
else
    echo -e "${YELLOW}⚠️  Document status: ${STATUS}${NC}"
    if [ "$STATUS" = "pending" ]; then
        echo "   Processing may still be in progress..."
    elif [ "$STATUS" = "failed" ]; then
        echo "   Processing failed - check backend logs"
    fi
fi
echo ""

echo "Step 6: Verify embeddings were created"
echo "--------------------------------------"
EMBEDDINGS_RESPONSE=$(curl -s \
  "${SUPABASE_URL}/rest/v1/embeddings?document_id=eq.${DOC_ID}&select=chunk_index,chunk_size" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

EMBEDDING_COUNT=$(echo "$EMBEDDINGS_RESPONSE" | jq 'length')

if [ "$EMBEDDING_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Embeddings created: ${EMBEDDING_COUNT} chunks${NC}"
    echo "   Chunk details:"
    echo "$EMBEDDINGS_RESPONSE" | jq '.[] | "   - Chunk \(.chunk_index): \(.chunk_size) chars"' -r
else
    echo -e "${RED}❌ No embeddings found${NC}"
fi
echo ""

echo "Step 7: Test RAG query"
echo "---------------------"
echo "   Sending test query: 'What are the ABCDE warning signs of melanoma?'"

# Create a test session
SESSION_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

QUERY_RESPONSE=$(curl -s -X POST \
  "${BACKEND_URL}/api/v1/sessions/${SESSION_ID}/messages" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What are the ABCDE warning signs of melanoma?",
    "user_id": "test-user"
  }')

echo "   Response:"
echo "$QUERY_RESPONSE" | jq '.answer // .error // .' 2>/dev/null || echo "$QUERY_RESPONSE"
echo ""

echo "================================================"
echo "Summary:"
echo "================================================"
echo "Document ID: $DOC_ID"
echo "Status: $STATUS"
echo "Embeddings: $EMBEDDING_COUNT chunks"
echo ""

if [ "$STATUS" = "processed" ] && [ "$EMBEDDING_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ Document upload and indexing SUCCESSFUL${NC}"
    echo ""
    echo "You can now query this document through the chat interface."
else
    echo -e "${RED}❌ Document upload or indexing FAILED${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "  1. Check backend logs for errors"
    echo "  2. Verify embedding service is initialized"
    echo "  3. Check Supabase connection and credentials"
    echo "  4. Ensure B+ tree indexing is working"
fi
echo ""

# Cleanup
rm -f "$TEST_FILE"
echo "Test file cleaned up."
