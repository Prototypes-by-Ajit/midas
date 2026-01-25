#!/bin/bash

echo "🐳 MIDAS Docker Deployment Script"
echo "=================================="
echo ""

# Load environment variables
if [ -f .env ]; then
    echo "📝 Loading environment variables from .env"
    export $(cat .env | grep -v '^#' | xargs)
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Error: Docker is not running"
    echo "Please start Docker Desktop and try again"
    exit 1
fi

echo "✅ Docker is running"
echo ""

# Stop and remove existing containers
echo "🛑 Stopping existing containers..."
docker-compose down

echo ""
echo "🏗️  Building Docker images..."
docker-compose build --no-cache

echo ""
echo "🚀 Starting services..."
docker-compose up -d

echo ""
echo "⏳ Waiting for services to be healthy..."
sleep 5

# Check service health
echo ""
echo "🏥 Health Check:"
echo "----------------------------------------"

# Backend health
BACKEND_STATUS=$(docker-compose ps backend --format json 2>/dev/null | jq -r '.[0].State' 2>/dev/null || echo "unknown")
echo "Backend:  $BACKEND_STATUS"

# Frontend health
FRONTEND_STATUS=$(docker-compose ps frontend --format json 2>/dev/null | jq -r '.[0].State' 2>/dev/null || echo "unknown")
echo "Frontend: $FRONTEND_STATUS"

# Redis health
REDIS_STATUS=$(docker-compose ps redis --format json 2>/dev/null | jq -r '.[0].State' 2>/dev/null || echo "unknown")
echo "Redis:    $REDIS_STATUS"

echo ""
echo "📊 Container Status:"
echo "----------------------------------------"
docker-compose ps

echo ""
echo "🌐 Access URLs:"
echo "----------------------------------------"
echo "Frontend:              http://localhost:3000"
echo "Agentic RAG System:    http://localhost:8000/docs"
echo "  - Router Agent"
echo "  - RAG Agent (Multi-Agent Architecture)"
echo "  - Web Scraping Agent"
echo "  - Image Analysis"
echo "Document Processing:   http://localhost:8001/docs"
echo "Redis Cache:           localhost:6379"
echo ""

echo "📝 View Logs:"
echo "----------------------------------------"
echo "All logs:     docker-compose logs -f"
echo "Backend:      docker-compose logs -f backend"
echo "Frontend:     docker-compose logs -f frontend"
echo ""

echo "🛑 Stop Services:"
echo "----------------------------------------"
echo "docker-compose down"
echo ""

echo "✅ Deployment Complete!"
