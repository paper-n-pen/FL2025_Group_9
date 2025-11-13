# Quick Fix for Docker Connection Issue

## The Problem:
Docker Desktop is running but the daemon socket is not accessible at `/Users/mehaksharma/.docker/run/docker.sock`

## Quick Solution:

### Option 1: Restart Docker Desktop (Recommended)
1. **Quit Docker Desktop completely:**
   - Click Docker icon in menu bar → "Quit Docker Desktop"
   - Or: `killall Docker` in terminal

2. **Wait 10 seconds, then restart:**
   - Open Docker Desktop from Applications folder
   - Wait 60 seconds for it to fully start
   - Check menu bar shows "Docker Desktop is running"

3. **Test:**
   ```bash
   docker ps
   ```
   Should show empty list (no errors)

4. **Then run:**
   ```bash
   docker-compose up --build
   ```

### Option 2: Reset Docker Context
If restart doesn't work:
```bash
docker context use desktop-linux
docker ps  # Test connection
```

### Option 3: Check Docker Desktop Resources
1. Open Docker Desktop
2. Settings → Resources
3. Make sure you have enough:
   - Memory: At least 4GB
   - Disk: At least 20GB free
4. Click "Apply & Restart"

### Option 4: Nuclear Option (Last Resort)
If nothing works:
1. Docker Desktop → Troubleshoot → Reset to factory defaults
2. This removes all containers/images but fixes connection
3. Then run `docker-compose up --build` again

## Most Common Fix:
**Just fully quit and restart Docker Desktop** - this fixes 90% of socket connection issues.

