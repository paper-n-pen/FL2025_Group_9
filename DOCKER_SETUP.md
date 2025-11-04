# Docker Setup Instructions

## Issue: Docker daemon not running

If you see the error: `Cannot connect to the Docker daemon`, follow these steps:

### Step 1: Start Docker Desktop
1. Open Docker Desktop application on your Mac
2. Wait until Docker Desktop shows "Docker Desktop is running" in the menu bar
3. Verify Docker is running by checking the Docker icon in the menu bar

### Step 2: Verify Docker is running
```bash
docker ps
```
This should show running containers (or an empty list if no containers are running).

### Step 3: Start the services
```bash
docker-compose up --build
```

Or run in detached mode (background):
```bash
docker-compose up -d --build
```

### Step 4: Check logs if issues occur
```bash
# View all logs
docker-compose logs

# View specific service logs
docker-compose logs backend
docker-compose logs frontend
docker-compose logs db
```

### Step 5: Stop services
```bash
docker-compose down
```

## Fixed Issues:
- ✅ Updated `nginx.conf` to properly proxy `/api` and `/socket.io` requests to backend
- ✅ Docker Compose configuration is valid

## Services:
- **Frontend**: http://localhost (port 80)
- **Backend**: http://localhost:3000
- **Database**: localhost:5432
- **Ollama**: localhost:11434

