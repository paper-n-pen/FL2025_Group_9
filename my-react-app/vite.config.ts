//my-react-app/vite.config.ts

declare const process: { env?: Record<string, string | undefined> } | undefined;

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const backendTarget = process?.env?.VITE_PROXY_TARGET ?? 'http://localhost:3001';

const proxyConfig = {
  '/api': {
    target: backendTarget,
    changeOrigin: true,
  },
  '/socket.io': {
    target: backendTarget,
    ws: true,
    changeOrigin: true,
  },
};

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: proxyConfig,
  },
  preview: {
    proxy: proxyConfig,
  },
});
