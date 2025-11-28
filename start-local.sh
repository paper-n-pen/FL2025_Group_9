#!/bin/bash

# Quick start script for local development
# This script starts both backend and frontend servers

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}Starting MicroTutor Platform Locally...${NC}\n"

# Add PostgreSQL to PATH if needed
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"

# Check if PostgreSQL is running
if ! pg_isready -U myapp_user -d myapp_db > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL might not be running. Starting it..."
    brew services start postgresql@16
    sleep 2
fi

# Function to cleanup on exit
cleanup() {
    echo -e "\n${BLUE}Shutting down servers...${NC}"
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    exit
}

trap cleanup SIGINT SIGTERM

# Start backend
echo -e "${GREEN}Starting backend server...${NC}"
cd "$(dirname "$0")/backend"
npm run dev &
BACKEND_PID=$!

# Wait a bit for backend to start
sleep 3

# Start frontend
echo -e "${GREEN}Starting frontend server...${NC}"
cd "$(dirname "$0")/my-react-app"
npm run dev &
FRONTEND_PID=$!

echo -e "\n${GREEN}✅ Servers are starting!${NC}"
echo -e "${BLUE}Backend:${NC} http://localhost:3000"
echo -e "${BLUE}Frontend:${NC} http://localhost:5173"
echo -e "\n${BLUE}Press Ctrl+C to stop both servers${NC}\n"

# Wait for both processes
wait

