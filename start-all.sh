#!/bin/bash
# Also works with sh

# Script to start backend, frontend, and ngrok tunnels

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 Starting MicroTutor with Ngrok"
echo ""

# Check if backend is running
if ! lsof -ti:3001 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Backend not running on port 3001${NC}"
    echo "Starting backend..."
    cd "$(dirname "$0")/backend"
    export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
    PORT=3001 npm start > /tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    echo -e "${GREEN}✅ Backend starting (PID: $BACKEND_PID)${NC}"
    sleep 3
else
    echo -e "${GREEN}✅ Backend already running on port 3001${NC}"
fi

# Check if frontend is running
if ! lsof -ti:5173 > /dev/null 2>&1; then
    echo -e "${YELLOW}⚠️  Frontend not running on port 5173${NC}"
    echo "Starting frontend..."
    cd "$(dirname "$0")/my-react-app"
    npm run dev > /tmp/frontend.log 2>&1 &
    FRONTEND_PID=$!
    echo -e "${GREEN}✅ Frontend starting (PID: $FRONTEND_PID)${NC}"
    sleep 5
else
    echo -e "${GREEN}✅ Frontend already running on port 5173${NC}"
fi

# Function to get ngrok URL from a port
get_ngrok_url() {
    local port=$1
    local url=""
    
    # Method 1: Try with python3 JSON parsing
    if command -v python3 >/dev/null 2>&1; then
        url=$(curl -s "http://localhost:${port}/api/tunnels" 2>/dev/null | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'] if d.get('tunnels') and len(d['tunnels']) > 0 else '')" 2>/dev/null)
    fi
    
    # Method 2: Try with grep/sed if python fails
    if [ -z "$url" ]; then
        url=$(curl -s "http://localhost:${port}/api/tunnels" 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | sed 's/"public_url":"//')
    fi
    
    # Method 3: Try extracting from HTML dashboard
    if [ -z "$url" ]; then
        url=$(curl -s "http://localhost:${port}" 2>/dev/null | grep -oE 'https://[a-z0-9-]+\.ngrok[^"< ]+' | head -1)
    fi
    
    echo "$url"
}

# Kill existing ngrok processes
echo ""
echo "🧹 Cleaning up existing ngrok processes..."
pkill -f "ngrok http" 2>/dev/null
sleep 2

# Start backend ngrok tunnel
echo ""
echo -e "${GREEN}📡 Starting backend ngrok tunnel (port 3001)...${NC}"
cd "$(dirname "$0")"
ngrok http 3001 --log=stdout > /tmp/ngrok-backend.log 2>&1 &
BACKEND_NGROK_PID=$!
sleep 3

# Start frontend ngrok tunnel
echo -e "${GREEN}🌐 Starting frontend ngrok tunnel (port 5173)...${NC}"
ngrok http 5173 --log=stdout > /tmp/ngrok-frontend.log 2>&1 &
FRONTEND_NGROK_PID=$!
sleep 5

echo ""
echo -e "${YELLOW}⏳ Waiting for ngrok to initialize...${NC}"
sleep 8

# Try multiple times to get URLs
BACKEND_URL=""
FRONTEND_URL=""
for i in 1 2 3; do
    BACKEND_URL=$(get_ngrok_url 4040)
    FRONTEND_URL=$(get_ngrok_url 4041)
    if [ -n "$BACKEND_URL" ] && [ -n "$FRONTEND_URL" ]; then
        break
    fi
    if [ $i -lt 3 ]; then
        echo "   Attempt $i failed, retrying..."
        sleep 3
    fi
done

# Get URLs - try multiple methods
get_ngrok_url() {
    local port=$1
    local url=""
    
    # Method 1: Try with python3
    url=$(curl -s "http://localhost:${port}/api/tunnels" 2>/dev/null | python3 -c "import sys, json; d=json.load(sys.stdin); print(d['tunnels'][0]['public_url'] if d.get('tunnels') and len(d['tunnels']) > 0 else '')" 2>/dev/null)
    
    # Method 2: Try with grep/sed if python fails
    if [ -z "$url" ]; then
        url=$(curl -s "http://localhost:${port}/api/tunnels" 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | sed 's/"public_url":"//')
    fi
    
    # Method 3: Try extracting from HTML if API fails
    if [ -z "$url" ]; then
        url=$(curl -s "http://localhost:${port}" 2>/dev/null | grep -o 'https://[a-z0-9-]*\.ngrok[^"]*' | head -1)
    fi
    
    echo "$url"
}

BACKEND_URL=$(get_ngrok_url 4040)
FRONTEND_URL=$(get_ngrok_url 4041)

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$BACKEND_URL" ] && [ -n "$FRONTEND_URL" ]; then
    echo -e "${GREEN}✅ ALL SERVICES RUNNING!${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${GREEN}🌐 FRONTEND URL (SHARE THIS for testing):${NC}"
    echo "   $FRONTEND_URL"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo -e "${GREEN}📡 BACKEND URL (update .env with this):${NC}"
    echo "   $BACKEND_URL"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Add this to my-react-app/.env:"
    echo ""
    echo "VITE_API_URL=$BACKEND_URL"
    echo "VITE_BACKEND_URL=$BACKEND_URL"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📊 Ngrok Dashboards:"
    echo "   Backend:  http://localhost:4040"
    echo "   Frontend: http://localhost:4041"
    echo ""
    echo "📝 Logs:"
    echo "   Backend:  tail -f /tmp/backend.log"
    echo "   Frontend: tail -f /tmp/frontend.log"
    echo ""
    echo -e "${YELLOW}⚠️  Keep this terminal open! Press Ctrl+C to stop all services.${NC}"
else
    echo -e "${RED}❌ Could not get ngrok URLs${NC}"
    echo ""
    echo "Check manually:"
    echo "   Backend:  http://localhost:4040"
    echo "   Frontend: http://localhost:4041"
    echo ""
    echo "Or wait a few seconds and run: ./get-ngrok-urls.sh"
fi

echo ""
echo "Press Ctrl+C to stop all services..."

# Wait for interrupt
trap "echo ''; echo '🛑 Stopping all services...'; kill $BACKEND_NGROK_PID $FRONTEND_NGROK_PID 2>/dev/null; exit" INT
wait

