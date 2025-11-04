# CORS/Credentials Fix - File Changes

## Backend Changes

### `backend/index.js`

**Middleware Order & CORS:**
```diff
- // CORS must come first - allow multiple localhost origins
- const allowedOrigins = [...];
- const corsOptions = { origin: (origin, callback) => {...} };
- app.use(cors(corsOptions));
- app.options('*', cors(corsOptions));
- app.use(express.json());
- app.use(cookieParser());

+ // Parsers first
+ app.use(express.json());
+ app.use(express.urlencoded({ extended: true }));
+ app.use(cookieParser());
+ 
+ // CORS: allow Vite dev origin + credentials
+ const ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
+ const corsOptions = {
+   origin: ORIGIN,
+   credentials: true,
+   methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
+   allowedHeaders: ['Content-Type', 'Authorization'],
+ };
+ 
+ app.use(cors(corsOptions));
+ app.options('*', cors(corsOptions));
```

### `backend/routes/auth.js`

**Cookie Settings:**
```diff
- res.cookie("token", token, {
-   httpOnly: true,
-   secure: isProd,
-   sameSite: isProd ? "none" : "lax",
-   maxAge: 7 * 24 * 60 * 60 * 1000,
-   path: "/",
- });
+ res.cookie("token", token, {
+   httpOnly: true,
+   secure: false,     // dev only; set true behind HTTPS in prod
+   sameSite: 'lax',
+   maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
+   path: "/",
+ });
```

## Frontend Changes

### `my-react-app/src/lib/api.ts` (COMPLETE REWRITE)

**Simplified API Client:**
```typescript
const BASE = import.meta.env.VITE_API_URL ?? '';

async function api(path: string, opts: Opts = {}) {
  const headers = new Headers(opts.headers ?? {});
  if (opts.json !== undefined) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(`${BASE}${path}`, {
    credentials: 'include',
    ...opts,
    headers,
    body: opts.json !== undefined ? JSON.stringify(opts.json) : opts.body
  });
  let data: any = null;
  try { data = await res.json(); } catch { /* ignore */ }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

export const get = (p: string) => api(p);
export const post = (p: string, body: any) => api(p, { method: 'POST', json: body });
export const del = (p: string) => api(p, { method: 'DELETE' });

export default { get, post, del };
```

### `my-react-app/src/pages/student/StudentRegister.tsx`

```diff
- import { auth } from "../../lib/api";
- import type { ApiError } from "../../lib/api";
+ import api from "../../lib/api";

- const user = await auth.register({...});
+ const user = await api.post('/api/auth/register', {...});

- const apiError = err as ApiError;
- let errorMessage = apiError.error || apiError.message || "Registration failed. Please try again.";
- if (apiError.status === 0 || apiError.message?.includes('Failed to fetch')) {
-   errorMessage = `Network error: ${apiError.message}. Check DevTools > Network tab for details.`;
- }
- setError(`❌ ${errorMessage}`);
+ const errorMessage = err.message || "Registration failed. Please try again.";
+ setError(`❌ ${errorMessage}`);
```

### `my-react-app/src/pages/student/StudentLogin.tsx`

```diff
- import { auth } from "../../lib/api";
- import type { ApiError } from "../../lib/api";
+ import api from "../../lib/api";

- const user = await auth.login({...});
+ const user = await api.post('/api/auth/login', {...});

- const apiError = err as ApiError;
- let errorMessage = apiError.error || apiError.message || "Login failed. Please try again.";
- if (apiError.status === 0 || apiError.message?.includes('Failed to fetch')) {
-   errorMessage = `Network error: ${apiError.message}. Check DevTools > Network tab for details.`;
- }
- setError(errorMessage);
+ const errorMessage = err.message || "Login failed. Please try again.";
+ setError(errorMessage);
```

### `my-react-app/src/pages/tutor/TutorSetup.tsx`

```diff
- import { auth } from "../../lib/api";
- import type { ApiError } from "../../lib/api";
+ import api from "../../lib/api";

- const user = await auth.register({...});
+ const user = await api.post('/api/auth/register', {...});

- const apiError = err as ApiError;
- let errorMessage = apiError.error || apiError.message || "Registration failed. Please try again.";
- if (apiError.status === 0 || apiError.message?.includes('Failed to fetch')) {
-   errorMessage = `Network error: ${apiError.message}. Check DevTools > Network tab for details.`;
- }
- setError(`❌ ${errorMessage}`);
+ const errorMessage = err.message || "Registration failed. Please try again.";
+ setError(`❌ ${errorMessage}`);
```

### `my-react-app/src/pages/tutor/TutorLogin.tsx`

```diff
- import { auth } from "../../lib/api";
- import type { ApiError } from "../../lib/api";
+ import api from "../../lib/api";

- const user = await auth.login({...});
+ const user = await api.post('/api/auth/login', {...});

- const apiError = err as ApiError;
- let errorMessage = apiError.error || apiError.message || "Login failed. Please try again.";
- if (apiError.status === 0 || apiError.message?.includes('Failed to fetch')) {
-   errorMessage = `Network error: ${apiError.message}. Check DevTools > Network tab for details.`;
- }
- setError(errorMessage);
+ const errorMessage = err.message || "Login failed. Please try again.";
+ setError(errorMessage);
```

### `my-react-app/src/AppLayout.tsx`

```diff
- import { auth } from "./lib/api";
+ import api from "./lib/api";

- const data = await auth.me();
+ const data = await api.get('/api/auth/me');
```

### `my-react-app/src/pages/student/StudentDashboard.tsx`

```diff
- import { auth } from "../../lib/api";
+ import api from "../../lib/api";

- const data = await auth.me();
+ const data = await api.get('/api/auth/me');

- await auth.logout();
+ await api.post('/api/auth/logout', {});
```

### `my-react-app/src/pages/tutor/TutorDashboard.tsx`

```diff
- import { auth } from "../../lib/api";
+ import api from "../../lib/api";

- const data = await auth.me();
+ const data = await api.get('/api/auth/me');
```

### `my-react-app/src/main.tsx`

```diff
+ import api from "./lib/api";

+ // Health check on app mount
+ function AppHealthCheck() {
+   useEffect(() => {
+     api.get('/api/health')
+       .then((data) => console.log('✅ API Health:', data))
+       .catch((err) => console.error('❌ API Health check failed:', err));
+   }, []);
+   return null;
+ }

+ <AppHealthCheck />
```

### `my-react-app/vite.config.ts`

```diff
  server: {
+   port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
```

### `my-react-app/.env.local` (NEW)

```
VITE_API_URL=http://localhost:3000
```

## Summary

- **Backend**: Simplified CORS to single origin, proper middleware order, dev-safe cookies
- **Frontend**: Simplified API client, all auth forms use it, exact error messages
- **Health Check**: Automatic on app mount
- **Environment**: `.env.local` created with correct API URL

