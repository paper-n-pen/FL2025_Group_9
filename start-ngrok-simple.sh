#!/bin/bash
# Simple ngrok setup - starts both tunnels

echo "🚀 Starting Ngrok Tunnels"
echo ""

# Kill existing ngrok
pkill -f ngrok 2>/dev/null
sleep 2

# Start backend tunnel
echo "📡 Backend tunnel (port 3001) - Dashboard: http://localhost:4040"
ngrok http 3001 &
sleep 2

# Start frontend tunnel  
echo "🌐 Frontend tunnel (port 5173) - Dashboard: http://localhost:4041"
ngrok http 5173 &

echo ""
echo "✅ Tunnels started!"
echo "📊 Check dashboards above for URLs"
echo "⚠️  Update my-react-app/.env with backend URL"
echo ""
echo "Press Ctrl+C to stop"
wait
