#!/bin/bash

# Start ngrok using config file (supports multiple tunnels)

echo "🚀 Starting Ngrok with Config File"
echo ""

# Kill existing ngrok
pkill -f ngrok 2>/dev/null
sleep 2

# Check if config file exists
CONFIG_FILE="$(dirname "$0")/ngrok.yml"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "❌ ngrok.yml not found!"
    echo "Creating default config..."
    cat > "$CONFIG_FILE" << 'EOF'
version: "2"
tunnels:
  backend:
    addr: 3001
    proto: http
    inspect: true
  frontend:
    addr: 5173
    proto: http
    inspect: true
EOF
fi

# Start ngrok with config
echo "📡 Starting ngrok tunnels (backend + frontend)..."
ngrok start --all --config="$CONFIG_FILE" > /tmp/ngrok.log 2>&1 &
NGROK_PID=$!

echo "✅ Ngrok started (PID: $NGROK_PID)"
echo ""
echo "⏳ Waiting for tunnels to initialize..."
sleep 8

# Get URLs from ngrok API (single instance, so port 4040)
echo ""
echo "🔍 Getting tunnel URLs..."
BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; d=json.load(sys.stdin); tunnels = [t for t in d.get('tunnels', []) if 'backend' in t.get('name', '').lower() or '3001' in str(t.get('config', {}).get('addr', ''))]; print(tunnels[0]['public_url'] if tunnels else '')" 2>/dev/null)

FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | python3 -c "import sys, json; d=json.load(sys.stdin); tunnels = [t for t in d.get('tunnels', []) if 'frontend' in t.get('name', '').lower() or '5173' in str(t.get('config', {}).get('addr', ''))]; print(tunnels[0]['public_url'] if tunnels else '')" 2>/dev/null)

if [ -z "$BACKEND_URL" ] || [ -z "$FRONTEND_URL" ]; then
    # Try simpler method
    BACKEND_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | head -1 | sed 's/"public_url":"//')
    FRONTEND_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | tail -1 | sed 's/"public_url":"//')
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -n "$BACKEND_URL" ] && [ -n "$FRONTEND_URL" ]; then
    echo "✅ TUNNELS ACTIVE!"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "🌐 FRONTEND URL (SHARE THIS for testing):"
    echo "   $FRONTEND_URL"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📡 BACKEND URL (update .env with this):"
    echo "   $BACKEND_URL"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "📋 Add to my-react-app/.env:"
    echo "VITE_API_URL=$BACKEND_URL"
    echo "VITE_BACKEND_URL=$BACKEND_URL"
    echo ""
else
    echo "⚠️  Could not auto-detect URLs"
    echo ""
    echo "📊 Check ngrok dashboard:"
    echo "   http://localhost:4040"
    echo ""
    echo "You'll see both tunnels listed there!"
    echo "Look for:"
    echo "  - One tunnel pointing to localhost:3001 (backend)"
    echo "  - One tunnel pointing to localhost:5173 (frontend)"
    echo ""
    echo "Copy the 'Forwarding' URLs from the dashboard."
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Ngrok Dashboard: http://localhost:4040"
echo "📝 Logs: tail -f /tmp/ngrok.log"
echo ""
echo "Press Ctrl+C to stop ngrok"
echo ""

# Wait
trap "echo ''; echo '🛑 Stopping ngrok...'; kill $NGROK_PID 2>/dev/null; exit" INT
wait

