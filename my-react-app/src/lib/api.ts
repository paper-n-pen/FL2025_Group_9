// my-react-app/src/lib/api.ts
// Simple API client with credentials

// In Docker/production, use relative URLs (nginx proxy handles it)
// In local dev, use VITE_API_URL if set, otherwise empty (uses vite proxy)
const metaEnv = (import.meta as unknown as {
  env?: Record<string, string | undefined>;
}).env;

const BASE = metaEnv?.VITE_API_URL ?? '';

type Opts = RequestInit & { json?: any };
type ApiOptions = Omit<Opts, "method" | "body" | "json">;

async function api(path: string, opts: Opts = {}) {
  const headers = new Headers(opts.headers ?? {});
  let body: BodyInit | null = null;

  if (opts.json) {
    if (opts.json instanceof FormData) {
      // Let the browser set the Content-Type for FormData
      body = opts.json;
    } else {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(opts.json);
    }
  }

  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    ...opts,
    headers,
    body,
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

export const get = (p: string, opts?: ApiOptions) =>
  opts ? api(p, opts as Opts) : api(p);
export const post = (p: string, body: any, opts?: ApiOptions) =>
  api(p, { ...(opts ?? {}), method: 'POST', json: body });
export const put = (p: string, body: any, opts?: ApiOptions) =>
  api(p, { ...(opts ?? {}), method: 'PUT', json: body });
export const del = (p: string, opts?: ApiOptions) =>
  api(p, { ...(opts ?? {}), method: 'DELETE' });

export default { get, post, put, del };
