// my-react-app/src/lib/api.ts
// Simple API client with credentials

// In Docker/production, use relative URLs (nginx proxy handles it)
// In local dev, use VITE_API_URL if set, otherwise empty (uses vite proxy)
const metaEnv = (import.meta as unknown as {
  env?: Record<string, string | undefined>;
}).env;

const BASE = metaEnv?.VITE_API_URL ?? "";

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonBody = JsonValue | FormData;

type Opts = RequestInit & { json?: JsonBody };
type ApiOptions = Omit<Opts, "method" | "body" | "json">;

const extractErrorMessage = (payload: unknown): string | undefined => {
  if (payload && typeof payload === "object") {
    const { error, message } = payload as {
      error?: unknown;
      message?: unknown;
    };
    if (typeof error === "string" && error.trim()) return error;
    if (typeof message === "string" && message.trim()) return message;
  }
  return undefined;
};

async function api<T = unknown>(path: string, opts: Opts = {}): Promise<T> {
  const headers = new Headers(opts.headers ?? {});
  let body: BodyInit | null = null;

  if (typeof opts.json !== "undefined") {
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
  let data: unknown = null;
  try {
    data = await res.json();
  } catch {
    /* ignore non-JSON responses */
  }
  if (!res.ok) {
    const message = extractErrorMessage(data) ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data as T;
}

export const get = <T = unknown>(p: string, opts?: ApiOptions) =>
  opts ? api<T>(p, opts as Opts) : api<T>(p);
export const post = <T = unknown>(p: string, body: JsonBody, opts?: ApiOptions) =>
  api<T>(p, { ...(opts ?? {}), method: "POST", json: body });
export const put = <T = unknown>(p: string, body: JsonBody, opts?: ApiOptions) =>
  api<T>(p, { ...(opts ?? {}), method: "PUT", json: body });
export const del = <T = unknown>(p: string, opts?: ApiOptions) =>
  api<T>(p, { ...(opts ?? {}), method: "DELETE" });

export default { get, post, put, del };
