# "Failed to Fetch" Fix Summary

## Changes Made

### 1. Frontend (`my-react-app/`)

#### API Client (`src/lib/api.ts`)
- Changed `BASE_URL` to `BASE` with fallback: `import.meta.env.VITE_API_URL || '/api'`
- Added `safeFetch()` wrapper for better network error handling
- Enhanced error messages to include "Check DevTools > Network tab"

#### Environment (`.env.local`)
- Created `.env.local` with `VITE_API_URL=http://localhost:3000`
- Vite proxy configured in `vite.config.ts` with `changeOrigin: true`

#### Error Messages
- Updated all auth forms (StudentRegister, TutorSetup, StudentLogin, TutorLogin) to show network errors with DevTools hint

### 2. Backend (`backend/`)

#### Health Check
- Added `GET /api/health` returning `{ ok: true }`

#### CORS
- Simplified to single origin: `process.env.CORS_ORIGIN || 'http://localhost:5173'`
- Ensures `credentials: true` for cookie-based auth

#### Database Configuration (`db.js`)
- Reads from `DATABASE_URL` or falls back to `PG*` or `DB_*` env vars
- Supports both connection string and individual variables

#### Startup Logging (`index.js`)
- Logs PORT, DB host, user, and database name on startup
- Runs `db-check.js` on successful connection
- Non-blocking: server starts even if DB connection fails

#### Database Check Script (`scripts/db-check.js`)
- Checks users, tutors, students counts
- Lists all tables
- Runs automatically on server start

#### Environment Example (`.env.example`)
- Created comprehensive `.env.example` with all variables
- Documents `DATABASE_URL`, `PG*`, `DB_*` options

## Files Modified

### Frontend
1. `my-react-app/src/lib/api.ts` - API client base URL and error handling
2. `my-react-app/vite.config.ts` - Proxy configuration
3. `my-react-app/src/pages/student/StudentRegister.tsx` - Enhanced error messages
4. `my-react-app/src/pages/student/StudentLogin.tsx` - Enhanced error messages
5. `my-react-app/src/pages/tutor/TutorSetup.tsx` - Enhanced error messages
6. `my-react-app/src/pages/tutor/TutorLogin.tsx` - Enhanced error messages

### Backend
1. `backend/index.js` - Health check, CORS, startup logging
2. `backend/db.js` - Environment variable handling
3. `backend/scripts/db-check.js` - **NEW** Database health check script
4. `backend/.env.example` - **NEW** Environment variable template

### Documentation
1. `README.md` - Added local run snippets

## Verification Runbook

### 1. Health Check
```bash
curl http://localhost:3000/api/health
# Expected: {"ok":true}
```

### 2. Register Student
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"student","name":"Alice","email":"alice@test.com","password":"secret12"}'
# Expected: {"id":1,"role":"student","name":"Alice","email":"alice@test.com"}
```

### 3. Login
```bash
curl -i -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"secret12"}'
# Expected: 200 with user object and Set-Cookie header
```

### 4. Get Current User
```bash
curl -b /tmp/cookies.txt http://localhost:3000/api/auth/me
# Expected: {"user":{"id":1,"role":"student",...}}
```

### 5. Browser Test
1. Open `http://localhost:5173/student/register`
2. Fill form and submit
3. Should see loading spinner → success → redirect to dashboard
4. If error: Should show detailed message with DevTools hint

## Key Fixes

1. **API Base URL**: Uses `/api` when `VITE_API_URL` not set (Vite proxy)
2. **Network Errors**: Better error messages with DevTools guidance
3. **CORS**: Single origin for simplicity, credentials enabled
4. **Database**: Flexible env var support (DATABASE_URL, PG*, DB_*)
5. **Health Check**: Simple endpoint for monitoring
6. **Startup Logging**: Clear visibility into configuration

## Troubleshooting

### "Failed to fetch" still occurs
1. Check `VITE_API_URL` in `.env.local` matches backend port
2. Verify backend is running: `curl http://localhost:3000/api/health`
3. Check CORS: Backend logs should show origin
4. Open DevTools > Network tab to see actual request/response

### Database connection fails
1. Check `DATABASE_URL` or individual `PG*`/`DB_*` vars
2. Verify Postgres is running: `docker compose ps db`
3. Check startup logs for DB host/user/name

