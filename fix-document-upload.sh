#!/bin/bash

# MIDAS Document Upload Fix Script
# This script updates the Supabase Edge Function with the correct backend URL

echo "🔧 MIDAS Document Upload Fix"
echo "================================"
echo ""

# Step 1: Get Railway backend URL
echo "📍 Step 1: Identify your Railway backend URL"
echo ""
echo "Please enter your Railway backend URL:"
echo "(Example: https://midas-backend-production.up.railway.app)"
read -p "Backend URL: " BACKEND_URL

if [ -z "$BACKEND_URL" ]; then
    echo "❌ Error: Backend URL cannot be empty"
    exit 1
fi

echo ""
echo "✅ Backend URL: $BACKEND_URL"
echo ""

# Step 2: Test backend connectivity
echo "📍 Step 2: Testing backend connectivity..."
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/v1/health")

if [ "$HTTP_CODE" == "200" ]; then
    echo "✅ Backend is accessible (HTTP 200)"
elif [ "$HTTP_CODE" == "404" ]; then
    echo "⚠️  Backend reachable but /health endpoint not found (HTTP 404)"
    echo "   This is okay if your backend doesn't have a health endpoint"
else
    echo "❌ Backend not accessible (HTTP $HTTP_CODE)"
    echo "   Please check if your backend is deployed and running"
    exit 1
fi

echo ""

# Step 3: Update Supabase Edge Function environment variable
echo "📍 Step 3: Updating Supabase Edge Function environment variable..."
echo ""

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not installed"
    echo ""
    echo "Install it with:"
    echo "  npm install -g supabase"
    echo ""
    echo "Or manually update in Supabase Dashboard:"
    echo "  https://supabase.com/dashboard"
    echo "  → Your Project"
    echo "  → Edge Functions"
    echo "  → process-document"
    echo "  → Settings → Environment Variables"
    echo "  → Add: BACKEND_URL = $BACKEND_URL"
    exit 1
fi

# Set the environment variable
echo "Setting BACKEND_URL in Supabase Edge Function..."
supabase secrets set BACKEND_URL="$BACKEND_URL" 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Environment variable set successfully"
else
    echo "❌ Failed to set environment variable"
    echo ""
    echo "Please set manually in Supabase Dashboard:"
    echo "  https://supabase.com/dashboard"
    echo "  → Your Project"
    echo "  → Edge Functions"
    echo "  → process-document"
    echo "  → Settings → Environment Variables"
    echo "  → Add: BACKEND_URL = $BACKEND_URL"
    exit 1
fi

echo ""

# Step 4: Redeploy Edge Function
echo "📍 Step 4: Redeploying Edge Function..."
cd "$(dirname "$0")"

if [ -d "supabase/functions/process-document" ]; then
    supabase functions deploy process-document --no-verify-jwt

    if [ $? -eq 0 ]; then
        echo "✅ Edge Function redeployed successfully"
    else
        echo "❌ Failed to redeploy Edge Function"
        exit 1
    fi
else
    echo "❌ Edge Function directory not found"
    exit 1
fi

echo ""
echo "================================"
echo "✅ Fix Complete!"
echo ""
echo "Next steps:"
echo "1. Try uploading a document again"
echo "2. Check Edge Function logs:"
echo "   supabase functions logs process-document --limit 20"
echo "3. Check backend logs in Railway dashboard"
echo "4. Verify document status in database:"
echo "   SELECT id, file_name, status FROM documents ORDER BY created_at DESC LIMIT 5;"
echo ""
