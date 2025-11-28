#!/bin/bash

# Ngrok setup script for MicroTutor
# This script starts ngrok tunnels for both backend and frontend

echo "🚀 Starting Ngrok Tunnels for MicroTutor"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if ngrok is installed
if ! command -v ngrok &> /dev/null; then
    echo "❌ ngrok is not installed. Please install it first:"
    echo "   brew install ngrok/ngrok/ngrok"
    exit 1
fi

# Kill any existing ngrok processes
echo "🧹 Cleaning up existing ngrok processes..."
pkill -f ngrok || true
sleep 2

# Start backend tunnel (port 3001)
echo -e "${GREEN}📡 Starting backend tunnel (port 3001)...${NC}"
ngrok http 3001 --log=stdout > /tmp/ngrok-backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# Start frontend tunnel (port 5173)
echo -e "${GREEN}🌐 Starting frontend tunnel (port 5173)...${NC}"
ngrok http 5173 --log=stdout > /tmp/ngrok-frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

# Get ngrok URLs
echo ""
echo -e "${YELLOW}⏳ Waiting for ngrok to initialize...${NC}"
sleep 5

# Try to get URLs from ngrok API
BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4 || echo "")
FRONTEND_URL=$(curl -s http://localhost:4041/api/tunnels | grep -o '"public_url":"https://[^"]*' | head -1 | cut -d'"' -f4 || echo "")

if [ -z "$BACKEND_URL" ]; then
    echo "⚠️  Could not automatically detect backend URL. Please check:"
    echo "   http://localhost:4040"
    BACKEND_URL="https://YOUR-BACKEND-NGROK-URL.ngrok-free.app"
fi

if [ -z "$FRONTEND_URL" ]; then
    echo "⚠️  Could not automatically detect frontend URL. Please check:"
    echo "   http://localhost:4041"
    FRONTEND_URL="https://YOUR-FRONTEND-NGROK-URL.ngrok-free.app"
fi

echo ""
echo -e "${GREEN}✅ Ngrok Tunnels Started!${NC}"
echo ""
echo "📡 Backend URL:  $BACKEND_URL"
echo "🌐 Frontend URL: $FRONTEND_URL"
echo ""
echo "📊 Ngrok Dashboards:"
echo "   Backend:  http://localhost:4040"
echo "   Frontend: http://localhost:4041"
echo ""
echo -e "${YELLOW}⚠️  IMPORTANT: Update your frontend .env file with these URLs:${NC}"
echo ""
echo "   VITE_API_URL=$BACKEND_URL"
echo "   VITE_BACKEND_URL=$BACKEND_URL"
echo ""
echo "   Then restart your frontend dev server!"
echo ""
echo "Press Ctrl+C to stop ngrok tunnels"

# Wait for user interrupt
trap "echo ''; echo '🛑 Stopping ngrok...'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT
wait

