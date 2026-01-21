#!/bin/bash

# MIDAS Document Upload Status Checker
# Quick diagnostic tool to check document upload and processing status

echo "🔍 MIDAS Document Upload Status Check"
echo "======================================"
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not installed"
    echo "Install with: npm install -g supabase"
    exit 1
fi

# Check recent Edge Function logs
echo "📋 Recent Edge Function Logs (process-document):"
echo "------------------------------------------------"
supabase functions logs process-document --limit 10
echo ""

# Check recent documents in database
echo "📊 Recent Documents Status:"
echo "------------------------------------------------"
supabase db query "
SELECT
    id,
    file_name,
    status,
    created_at,
    updated_at,
    (updated_at - created_at) as processing_time
FROM documents
ORDER BY created_at DESC
LIMIT 10;
" --format table

echo ""

# Check if embeddings were created
echo "📈 Embedding Count by Document:"
echo "------------------------------------------------"
supabase db query "
SELECT
    d.file_name,
    d.status,
    d.created_at,
    COUNT(e.id) as embedding_count
FROM documents d
LEFT JOIN embeddings e ON e.document_id = d.id
WHERE d.created_at > NOW() - INTERVAL '24 hours'
GROUP BY d.id, d.file_name, d.status, d.created_at
ORDER BY d.created_at DESC
LIMIT 10;
" --format table

echo ""

# Check failed documents
echo "❌ Failed Documents (if any):"
echo "------------------------------------------------"
supabase db query "
SELECT
    id,
    file_name,
    status,
    error_message,
    created_at
FROM documents
WHERE status = 'failed'
ORDER BY created_at DESC
LIMIT 5;
" --format table

echo ""

# Check Edge Function environment variables
echo "🔧 Edge Function Environment:"
echo "------------------------------------------------"
echo "Checking if BACKEND_URL is set..."
supabase secrets list 2>&1 | grep -i backend || echo "⚠️  BACKEND_URL not found in secrets"

echo ""
echo "======================================"
echo "✅ Status check complete"
echo ""
echo "What to look for:"
echo "  • Documents with status 'processed' = ✅ Working"
echo "  • Documents with status 'pending' = ⚠️  Not processed"
echo "  • Documents with status 'failed' = ❌ Processing error"
echo "  • embedding_count > 0 = ✅ Embeddings created"
echo "  • embedding_count = 0 = ❌ No embeddings"
echo ""
