#!/bin/bash

# MIDAS Railway Runtime Fixes
# Fixes CORS preflight and Supabase storage URL issues

echo "🔧 MIDAS Railway Runtime Fix Script"
echo "===================================="
echo ""

# Check if railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not installed"
    echo ""
    echo "Install with:"
    echo "  npm install -g @railway/cli"
    echo ""
    echo "Or update environment variables manually via Railway Dashboard:"
    echo "  https://railway.app/dashboard"
    exit 1
fi

echo "📍 Step 1: Set CORS Origins"
echo ""
echo "Enter your frontend URL (e.g., https://midas.ajitkumar.io):"
read -p "Frontend URL: " FRONTEND_URL

if [ -z "$FRONTEND_URL" ]; then
    echo "❌ Error: Frontend URL cannot be empty"
    exit 1
fi

# Set CORS_ORIGINS
CORS_ORIGINS="http://localhost:3000,http://localhost:3001,${FRONTEND_URL}"
echo ""
echo "Setting CORS_ORIGINS to: $CORS_ORIGINS"
railway variables set CORS_ORIGINS="$CORS_ORIGINS"

if [ $? -eq 0 ]; then
    echo "✅ CORS_ORIGINS set successfully"
else
    echo "❌ Failed to set CORS_ORIGINS"
    exit 1
fi

echo ""
echo "📍 Step 2: Fix Supabase URL (add trailing slash)"
echo ""

# Get current Supabase URL
CURRENT_SUPABASE_URL=$(railway variables get SUPABASE_URL 2>/dev/null)

if [ -z "$CURRENT_SUPABASE_URL" ]; then
    echo "Enter your Supabase URL:"
    read -p "Supabase URL: " CURRENT_SUPABASE_URL
fi

# Add trailing slash if not present
if [[ ! "$CURRENT_SUPABASE_URL" =~ /$ ]]; then
    FIXED_SUPABASE_URL="${CURRENT_SUPABASE_URL}/"
    echo ""
    echo "Updating SUPABASE_URL:"
    echo "  From: $CURRENT_SUPABASE_URL"
    echo "  To:   $FIXED_SUPABASE_URL"

    railway variables set SUPABASE_URL="$FIXED_SUPABASE_URL"

    if [ $? -eq 0 ]; then
        echo "✅ SUPABASE_URL updated successfully"
    else
        echo "❌ Failed to update SUPABASE_URL"
        exit 1
    fi
else
    echo "✅ SUPABASE_URL already has trailing slash"
fi

echo ""
echo "📍 Step 3: Commit and push code changes"
echo ""

cd "$(dirname "$0")"

# Check if there are changes to commit
if git diff --quiet backend/app/main_agent.py backend/app/config.py; then
    echo "ℹ️  No code changes to commit"
else
    echo "Committing fixes to main_agent.py and config.py..."
    git add backend/app/main_agent.py backend/app/config.py
    git commit -m "Fix: Add CORS preflight handler and Supabase URL normalizer

- Add OPTIONS bypass middleware to handle CORS preflight
- Add supabase_url_normalized property for trailing slash
- Fixes Railway runtime CORS 400 errors"

    if [ $? -eq 0 ]; then
        echo "✅ Changes committed"

        echo ""
        read -p "Push to remote? (y/n): " PUSH_CONFIRM

        if [ "$PUSH_CONFIRM" = "y" ]; then
            git push origin main

            if [ $? -eq 0 ]; then
                echo "✅ Changes pushed to remote"
            else
                echo "❌ Failed to push changes"
                exit 1
            fi
        else
            echo "⚠️  Skipping push. Push manually with: git push origin main"
        fi
    else
        echo "❌ Failed to commit changes"
        exit 1
    fi
fi

echo ""
echo "===================================="
echo "✅ Fixes Applied!"
echo ""
echo "What was done:"
echo "  1. ✅ CORS_ORIGINS updated with production domain"
echo "  2. ✅ SUPABASE_URL fixed with trailing slash"
echo "  3. ✅ Code changes committed (CORS preflight handler)"
echo ""
echo "Next steps:"
echo "  1. Wait for Railway to auto-deploy (or trigger manually)"
echo "  2. Check logs: railway logs"
echo "  3. Test preflight:"
echo "     curl -X OPTIONS https://your-backend.railway.app/api/v1/health \\"
echo "       -H \"Origin: $FRONTEND_URL\" \\"
echo "       -H \"Access-Control-Request-Method: GET\""
echo "  4. Verify no more OPTIONS 400 errors"
echo ""
