# Docker Daemon Not Connecting - Fix Steps

## Issue: Docker daemon socket not found

The Docker backend process is running but the daemon socket is not accessible.

## Solution Steps:

### Step 1: Fully Restart Docker Desktop
1. **Quit Docker Desktop completely:**
   - Click the Docker icon in the Mac menu bar (top right)
   - Select "Quit Docker Desktop"
   - Wait 10 seconds

2. **Restart Docker Desktop:**
   - Open Docker Desktop from Applications
   - Wait until you see the Docker icon in the menu bar
   - Wait until the menu bar shows "Docker Desktop is running" (can take 30-60 seconds)

### Step 2: Verify Docker is Working
Open a terminal and run:
```bash
docker ps
```
This should show an empty list (no error) if Docker is working.

### Step 3: If Still Not Working - Reset Docker Context
```bash
# Check current context
docker context ls

# Switch to default context
docker context use default

# Or reset to desktop-linux
docker context use desktop-linux
```

### Step 4: Try Running Docker Compose Again
```bash
cd /Users/mehaksharma/Documents/MicroTutor---On-Demand-Micro-Tutoring-Platform
docker-compose up --build
```

## Alternative: Check Docker Desktop Settings
1. Open Docker Desktop
2. Go to Settings → General
3. Make sure "Use Docker Compose V2" is enabled
4. Apply & Restart

## If Still Failing:
Try resetting Docker Desktop:
1. Docker Desktop → Troubleshoot → Reset to factory defaults
2. This will remove all containers and images, but should fix the connection issue

