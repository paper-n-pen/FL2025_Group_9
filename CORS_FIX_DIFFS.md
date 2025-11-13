# CORS and Credentials Fix - File Changes

## Backend (`backend/index.js`)

### CORS Configuration
```diff
- const corsOrigin = process.env.CORS_ORIGIN || 'http://localhost:5173';
- app.use(cors({ origin: corsOrigin, credentials: true }));
+ const allowedOrigins = process.env.CORS_ORIGIN
+   ? process.env.CORS_ORIGIN.split(',').map(o => o.trim())
+   : [
+       'http://localhost',
+       'http://localhost:80',
+       'http://localhost:5173',
+       'http://127.0.0.1',
+       'http://127.0.0.1:80',
+       'http://127.0.0.1:5173',
+     ];
+ 
+ const corsOptions = {
+   origin: (origin, callback) => {
+     if (!origin) return callback(null, true);
+     if (allowedOrigins.includes(origin)) {
+       callback(null, true);
+     } else {
+       callback(new Error('Not allowed by CORS'));
+     }
+   },
+   credentials: true,
+   methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
+   allowedHeaders: ['Content-Type', 'Authorization'],
+ };
+ 
+ app.use(cors(corsOptions));
+ app.options('*', cors(corsOptions));
```

## Frontend (`my-react-app/src/lib/api.ts`)

### API Base URL
```diff
- const BASE = import.meta.env.VITE_API_URL || '';
+ const BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';
```

### URL Construction (already includes credentials: 'include')
- All apiPost, apiGet, apiPut, apiDelete already use `credentials: 'include'`
- No changes needed here

## Frontend (`my-react-app/src/components/Chatbot.tsx`)

### API URL and Credentials
```diff
- const apiUrl = import.meta.env.VITE_API_URL || '';
- const response = await axios.post(`${apiUrl}/api/chat`, {
+ const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
+ const response = await axios.post(`${apiUrl}/api/chat`, {
    messages: messagesToSend,
- });
+ }, { withCredentials: true });
```

## Frontend (`my-react-app/src/pages/tutor/TutorProfile.tsx`)

### API URL and Credentials
```diff
- await axios.put("http://localhost:3000/api/queries/profile", {
+ const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
+ await axios.put(`${apiUrl}/api/queries/profile`, {
    ...formData,
    ratePer10Min: normalizedRate,
    userId: stored.user.id,
- });
+ }, { withCredentials: true });
```

## Frontend (`my-react-app/src/main.tsx`)

### Axios Global Config
```diff
- axios.defaults.baseURL = import.meta.env.VITE_BACKEND_URL || "";
+ const apiBase = import.meta.env.VITE_API_URL || "";
+ axios.defaults.baseURL = apiBase;
+ // withCredentials already set globally
```

## New Files

- `my-react-app/.env.local` - Contains `VITE_API_URL=http://localhost:3000`

