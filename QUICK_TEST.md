# Quick Verification Test

## 1. Health Check
```bash
curl http://localhost:3000/api/health
```
Expected: `{"ok":true}`

## 2. Register Student
```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"role":"student","name":"Alice","email":"alice@test.com","password":"secret12"}'
```
Expected: `{"id":1,"role":"student","name":"Alice","email":"alice@test.com"}`

## 3. Login
```bash
curl -i -c /tmp/cookies.txt -b /tmp/cookies.txt \
  -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@test.com","password":"secret12"}'
```
Expected: 200 status, user object, Set-Cookie header

## 4. Get Current User
```bash
curl -b /tmp/cookies.txt http://localhost:3000/api/auth/me
```
Expected: `{"user":{"id":1,"role":"student",...}}`

## 5. Browser Test
1. Open `http://localhost:5173/student/register`
2. Fill form → Submit
3. Should see: Loading spinner → Success → Redirect to dashboard
4. If error: Detailed message with "Check DevTools > Network tab"
