import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";

const resolveBackendUrl = (): string => {
  const meta = typeof import.meta !== "undefined"
    ? (import.meta as { env?: Record<string, string | undefined> }).env
    : undefined;

  // In Docker/production, use relative URL (nginx proxy handles it)
  // In local dev, use VITE_BACKEND_URL or VITE_API_URL if set
  const backendUrl = meta?.VITE_BACKEND_URL || meta?.VITE_API_URL;
  if (backendUrl) {
    return backendUrl;
  }
  
  // Default to empty string for relative URL (works with nginx proxy in Docker)
  // Or use localhost:3000 for local dev
  return window.location.origin === 'http://localhost' || window.location.origin === 'http://localhost:80'
    ? '' // Relative URL - nginx will proxy to backend
    : 'http://localhost:3000';
};

export const SOCKET_ENDPOINT = resolveBackendUrl();

let socketInstance: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socketInstance) {
    // Use relative URL if empty string, otherwise use full URL
    const socketUrl = SOCKET_ENDPOINT || window.location.origin;
    console.log('🔌 Connecting Socket.IO to:', socketUrl);
    socketInstance = io(socketUrl, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    
    socketInstance.on('connect', () => {
      console.log('✅ Socket.IO connected:', socketInstance?.id);
    });
    
    socketInstance.on('disconnect', () => {
      console.log('❌ Socket.IO disconnected');
    });
    
    socketInstance.on('connect_error', (error) => {
      console.error('❌ Socket.IO connection error:', error);
    });
  }

  return socketInstance;
};

export const disconnectSocket = () => {
  if (!socketInstance) {
    return;
  }

  socketInstance.disconnect();
  socketInstance = null;
};

export type SessionSocket = Socket;
