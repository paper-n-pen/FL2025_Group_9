#!/bin/bash

echo "🔍 Getting Ngrok URLs..."
echo ""

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

# Check backend tunnel
BACKEND_URL=$(get_ngrok_url 4040)

# Check frontend tunnel  
FRONTEND_URL=$(get_ngrok_url 4041)

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
    echo "❌ Ngrok tunnels not found!"
    echo ""
    echo "Please start ngrok first:"
    echo "  Terminal 1: ngrok http 3001"
    echo "  Terminal 2: ngrok http 5173"
    echo ""
    echo "Or use: ./start-ngrok-simple.sh"
    exit 1
fi

echo "✅ TUNNELS ACTIVE!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📡 BACKEND URL (copy to my-react-app/.env):"
echo "   $BACKEND_URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🌐 FRONTEND URL (SHARE THIS for testing on other PC):"
echo "   $FRONTEND_URL"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Add this to my-react-app/.env file:"
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

