#!/bin/bash

echo "🧪 Simple Document Upload Test (Localhost Only)"
echo "================================================"
echo ""

# Configuration
BACKEND_URL="http://localhost:8000"
SUPABASE_URL="https://mlacjzlhdmpufxqnmeze.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1sYWNqemxoZG1wdWZ4cW5tZXplIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcyMzIwNywiZXhwIjoyMDgzMjk5MjA3fQ.kN7Zf3HGR_6Qr6LbxY2144I36KeZeSmLzUQadTjI6_k"

# Generate unique ID
DOC_ID=$(uuidgen | tr '[:upper:]' '[:lower:]')

echo "📝 Step 1: Create document record in Supabase"
echo "   Document ID: $DOC_ID"

# Test content about melanoma
CONTENT='Melanoma is a serious form of skin cancer that develops in melanocytes. Early detection is crucial. The ABCDE rule helps identify suspicious moles: Asymmetry, Border irregularity, Color variation, Diameter greater than 6mm, and Evolution or change over time. Risk factors include UV exposure, fair skin, family history, and numerous moles. Treatment options include surgical excision, immunotherapy, and targeted therapy.'

# Create document record
echo ""
echo "   Inserting into documents table..."
INSERT_RESPONSE=$(curl -s -X POST \
  "${SUPABASE_URL}/rest/v1/documents" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d "{
    \"id\": \"${DOC_ID}\",
    \"title\": \"Test Melanoma Document $(date +%H:%M:%S)\",
    \"file_name\": \"test_melanoma.txt\",
    \"content\": $(echo "$CONTENT" | jq -Rs .),
    \"storage_path\": \"documents/test_${DOC_ID}.txt\",
    \"source\": \"upload\",
    \"source_type\": \"file\",
    \"status\": \"pending\"
  }")

if echo "$INSERT_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    echo "   ✅ Document record created"
else
    echo "   ❌ Failed to create document record"
    echo "   Response: $INSERT_RESPONSE"
    exit 1
fi

echo ""
echo "📤 Step 2: Call backend processing endpoint"
echo "   Endpoint: ${BACKEND_URL}/api/v1/documents/${DOC_ID}/process"
echo ""

PROCESS_RESPONSE=$(curl -s -X POST \
  "${BACKEND_URL}/api/v1/documents/${DOC_ID}/process" \
  -H "Content-Type: application/json" \
  -d "{\"document_id\": \"${DOC_ID}\"}")

echo "   Response:"
echo "$PROCESS_RESPONSE" | jq '.' 2>/dev/null || echo "$PROCESS_RESPONSE"

# Check if processing was successful
if echo "$PROCESS_RESPONSE" | jq -e '.success == true' > /dev/null 2>&1; then
    CHUNKS=$(echo "$PROCESS_RESPONSE" | jq -r '.embeddings_created // 0')
    echo ""
    echo "   ✅ Processing successful"
    echo "   📊 Embeddings created: $CHUNKS"
else
    echo ""
    echo "   ❌ Processing failed"
    echo "   Check backend terminal for error logs"
    exit 1
fi

echo ""
echo "🔍 Step 3: Verify document status"
sleep 2

STATUS_RESPONSE=$(curl -s \
  "${SUPABASE_URL}/rest/v1/documents?id=eq.${DOC_ID}&select=id,title,status" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

STATUS=$(echo "$STATUS_RESPONSE" | jq -r '.[0].status // "unknown"')
echo "   Document status: $STATUS"

if [ "$STATUS" = "processed" ]; then
    echo "   ✅ Status updated to 'processed'"
else
    echo "   ⚠️  Status is '$STATUS' (expected 'processed')"
fi

echo ""
echo "🔍 Step 4: Verify embeddings created"
EMBEDDINGS_RESPONSE=$(curl -s \
  "${SUPABASE_URL}/rest/v1/embeddings?document_id=eq.${DOC_ID}&select=chunk_index,chunk_size" \
  -H "apikey: ${SUPABASE_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_KEY}")

EMBEDDING_COUNT=$(echo "$EMBEDDINGS_RESPONSE" | jq 'length')
echo "   Embeddings found: $EMBEDDING_COUNT"

if [ "$EMBEDDING_COUNT" -gt 0 ]; then
    echo "   ✅ Embeddings successfully created"
    echo ""
    echo "   Chunk breakdown:"
    echo "$EMBEDDINGS_RESPONSE" | jq -r '.[] | "      Chunk \(.chunk_index): \(.chunk_size) characters"'
else
    echo "   ❌ No embeddings found"
fi

echo ""
echo "================================================"
echo "📊 SUMMARY"
echo "================================================"
echo "Document ID: $DOC_ID"
echo "Status: $STATUS"
echo "Embeddings: $EMBEDDING_COUNT chunks"
echo ""

if [ "$STATUS" = "processed" ] && [ "$EMBEDDING_COUNT" -gt 0 ]; then
    echo "✅ SUCCESS! Document indexed and ready for RAG queries"
    echo ""
    echo "You can now query this document through the chat interface."
    echo "Try asking: 'What are the ABCDE signs of melanoma?'"
else
    echo "❌ FAILED - Document not fully processed"
    echo ""
    echo "Check:"
    echo "  1. Backend terminal for error messages"
    echo "  2. Embedding model is loaded (should see in backend logs)"
    echo "  3. Supabase connection is working"
fi
echo ""
