# Verification Test Script

## 1. Start Backend
```bash
docker compose up -d --build backend
```

Wait for backend to start (check logs: `docker-compose logs backend`)

## 2. Test Preflight (OPTIONS)
```bash
curl -i -X OPTIONS http://localhost:3000/api/auth/login \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: content-type"
```

**Expected Response:**
```
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:5173
Access-Control-Allow-Credentials: true
Access-Control-Allow-Methods: GET,POST,PUT,PATCH,DELETE,OPTIONS
Access-Control-Allow-Headers: Content-Type,Authorization
```

## 3. Test Health Endpoint
```bash
curl http://localhost:3000/api/health
```

**Expected:** `{"ok":true,"db":"up"}`

## 4. Browser Console Test

Open browser console (F12) and run:
```javascript
fetch('http://localhost:3000/api/health', {credentials: 'include'})
  .then(r => r.json())
  .then(console.log)
  .catch(console.error);
```

**Expected:** `{ok: true, db: "up"}` logged to console

## 5. Test Registration

1. Open `http://localhost:5173/student/register`
2. Fill form:
   - Name: Test Student
   - Email: test@example.com
   - Password: test123
   - Confirm: test123
3. Submit
4. Check browser console:
   - Should see: `✅ API Health: {ok: true, db: "up"}`
   - Should see: "Submitting registration form..."
   - Should see: "Registration successful: {id: ..., role: 'student', ...}"
5. Should redirect to `/student/dashboard`

## 6. Test Login

1. Open `http://localhost:5173/student/login`
2. Fill form:
   - Email: test@example.com
   - Password: test123
3. Submit
4. Check Network tab:
   - Request should have `Origin: http://localhost:5173`
   - Response should have `Access-Control-Allow-Origin: http://localhost:5173`
   - Response should have `Set-Cookie: token=...`
5. Should redirect to `/student/dashboard`

## 7. Verify Cookies

After login, check browser DevTools:
- Application/Storage > Cookies > `http://localhost:5173`
- Should see `token` cookie with value

## Troubleshooting

If "Failed to fetch" still occurs:
1. Check backend logs: `docker-compose logs backend | tail -20`
2. Verify backend is running: `docker-compose ps backend`
3. Check CORS origin matches exactly (including port)
4. Hard refresh browser (Cmd+Shift+R / Ctrl+Shift+R)
5. Check Network tab for actual request/response headers
