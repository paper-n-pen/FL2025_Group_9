# Fix Docker Connection Issue - Step by Step

## The Problem:
Docker daemon socket is not accessible. Docker Desktop needs to be fully restarted.

## Step-by-Step Fix:

### Step 1: Check if Docker Desktop is Running
Look at your Mac menu bar (top right) - do you see the Docker whale icon?

### Step 2: Fully Quit Docker Desktop
**Option A - Via Menu:**
1. Click the Docker icon in menu bar
2. Select "Quit Docker Desktop"
3. Wait 10 seconds

**Option B - Via Terminal:**
```bash
killall Docker
killall "Docker Desktop"
```

### Step 3: Start Docker Desktop
1. Open **Applications** folder
2. Double-click **Docker** application
3. Wait 60-90 seconds for Docker to fully start
4. You'll see the Docker icon appear in menu bar
5. Wait until it shows "Docker Desktop is running" (not "Docker Desktop is starting")

### Step 4: Verify Docker is Working
```bash
docker ps
```
This should show an empty list (no errors). If you see an error, Docker isn't ready yet.

### Step 5: Test Pulling an Image
```bash
docker pull hello-world
docker run hello-world
```
If this works, Docker is fully functional.

### Step 6: Run Your Services
```bash
cd /Users/mehaksharma/Documents/MicroTutor---On-Demand-Micro-Tutoring-Platform
docker-compose up --build
```

## If Still Not Working:

### Check Docker Desktop Settings:
1. Open Docker Desktop
2. Go to **Settings → General**
3. Make sure "Use Docker Compose V2" is checked
4. Click "Apply & Restart"

### Check System Resources:
1. Docker Desktop → Settings → Resources
2. Ensure you have:
   - **Memory**: At least 4GB allocated
   - **Disk**: At least 20GB free space
3. Click "Apply & Restart"

### Last Resort - Reset Docker:
1. Docker Desktop → Troubleshoot → Reset to factory defaults
2. This removes all containers/images but fixes connection issues
3. Then run `docker-compose up --build` again

## Note:
I've made Ollama optional in docker-compose.yml so you can start the other services (frontend, backend, db) even if Ollama has issues. The backend will connect to Ollama on your host machine if it's running locally.

