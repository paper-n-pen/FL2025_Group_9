// my-react-app/src/lib/api.ts
// Simple API client with credentials

// In Docker/production, use relative URLs (nginx proxy handles it)
// In local dev, use VITE_API_URL if set, otherwise empty (uses vite proxy)
const BASE = import.meta.env.VITE_API_URL ?? '';

type Opts = RequestInit & { json?: any };

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
  // Network/CORS errors throw; non-2xx we still parse and throw with details
  let data: any = null;
  try { 
    data = await res.json(); 
  } catch { 
    /* ignore non-JSON responses */ 
  }
  if (!res.ok) {
    throw new Error(data?.error || data?.message || `HTTP ${res.status}`);
  }
  return data;
}

export const get = (p: string) => api(p);
export const post = (p: string, body: any) => api(p, { method: 'POST', json: body });
export const del = (p: string) => api(p, { method: 'DELETE' });

export default { get, post, del };
