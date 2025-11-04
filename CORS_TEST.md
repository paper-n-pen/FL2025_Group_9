# CORS and Credentials Fix - Testing Instructions

## Changes Made

### Backend
- ✅ CORS now allows: `http://localhost`, `http://localhost:80`, `http://localhost:5173`, `http://127.0.0.1`, `http://127.0.0.1:80`, `http://127.0.0.1:5173`
- ✅ Credentials enabled: `credentials: true`
- ✅ Preflight handler: `app.options('*', cors(corsOptions))`
- ✅ No wildcard origins (security)

### Frontend
- ✅ All API calls use `credentials: 'include'` (via centralized API client)
- ✅ BASE URL: `import.meta.env.VITE_API_URL || 'http://localhost:3000'`
- ✅ `.env.local` created with `VITE_API_URL=http://localhost:3000`
- ✅ Axios global config updated to use `VITE_API_URL`
- ✅ All direct axios calls now include `withCredentials: true`

## Test Steps

### 1. Backend Restart
```bash
docker compose up -d --build backend
```

### 2. Browser Console Test
Open browser console (F12) and run:

```javascript
// Test health endpoint with credentials
fetch('http://localhost:3000/api/health', {credentials: 'include'})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**Expected**: `{ok: true, db: "up"}`

### 3. Test Login/Register Forms
1. Open `http://localhost:5173/student/register`
2. Fill form and submit
3. Check browser console (F12) for any CORS errors
4. Should see loading spinner → success → redirect

### 4. Check Network Tab
- Open DevTools > Network tab
- Submit registration/login
- Check request headers:
  - Should include `Origin: http://localhost:5173`
  - Should include cookies (if any)
- Check response headers:
  - Should include `Access-Control-Allow-Origin: http://localhost:5173`
  - Should include `Access-Control-Allow-Credentials: true`

## Files Changed

See `CORS_FIX_DIFFS.md` for detailed diffs.

## Troubleshooting

If you still see "Failed to fetch":
1. Check backend logs: `docker-compose logs backend | tail -20`
2. Verify CORS origin matches exactly (including port)
3. Check browser console for specific CORS error messages
4. Ensure `.env.local` exists with `VITE_API_URL=http://localhost:3000`
5. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)

