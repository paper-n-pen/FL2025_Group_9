# Debug Registration Issue

## Steps to Debug:

1. **Try registering again** in the browser
2. **Check browser console** (F12 → Console tab) for any errors
3. **Check backend logs:**
   ```bash
   docker-compose logs backend --tail 50
   ```
4. **Check if request reaches backend:**
   ```bash
   docker-compose logs backend | grep -i "register"
   ```

## What I Fixed:

1. ✅ Changed registration form to use `/api/register` (relative URL for nginx proxy)
2. ✅ Added CORS support for `http://localhost` and `http://localhost:80`
3. ✅ Added detailed error logging to backend
4. ✅ Added better error messages to frontend (shows actual backend error)

## Common Issues:

- **Email already exists**: Backend will return "User already exists."
- **Missing fields**: Backend will return "username, email, and password are required"
- **Database error**: Check backend logs for SQL errors
- **CORS error**: Check browser console for CORS errors

## Next Steps:

After you try registering, check the logs and share what error you see!

