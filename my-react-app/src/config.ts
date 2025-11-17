// my-react-app/src/config.ts

const stripTrailingSlash = (value: string): string => value.replace(/\/+$/, "");

const ensureLeadingSlash = (value: string): string =>
  value.startsWith("/") ? value : `/${value}`;

const env = (import.meta as ImportMeta & {
  env: Record<string, string | undefined>;
}).env;

const rawBackendOrigin = env.VITE_BACKEND_URL?.trim();
const backendOrigin = rawBackendOrigin ? stripTrailingSlash(rawBackendOrigin) : undefined;

const resolveBrowserOrigin = (): string => {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "http://localhost:5173";
};

export const BACKEND_ORIGIN = backendOrigin ?? resolveBrowserOrigin();

const rawFrontendOrigin = env.VITE_FRONTEND_URL?.trim();
export const FRONTEND_ORIGIN = rawFrontendOrigin
  ? stripTrailingSlash(rawFrontendOrigin)
  : resolveBrowserOrigin();

export const API_PREFIX = ensureLeadingSlash(
  env.VITE_BACKEND_API_PREFIX?.trim() || "/api"
);

export const SOCKET_PATH = ensureLeadingSlash(
  env.VITE_SOCKET_PATH?.trim() || "/socket.io"
);

export const SOCKET_URL = backendOrigin;

export const apiPath = (path: string): string => {
  const sanitized = ensureLeadingSlash(path.trim());
  return `${API_PREFIX}${sanitized}`;
};

export const absoluteApiUrl = (path: string): string => {
  return `${BACKEND_ORIGIN}${apiPath(path)}`;
};
