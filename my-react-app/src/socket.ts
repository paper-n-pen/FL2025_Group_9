import { io } from "socket.io-client";
import type { ManagerOptions, Socket, SocketOptions } from "socket.io-client";
import { SOCKET_URL, SOCKET_PATH, BACKEND_ORIGIN } from "./config";

let socketInstance: Socket | null = null;

const socketConfig: Partial<ManagerOptions & SocketOptions> = {
  withCredentials: true,
  path: SOCKET_PATH,
  transports: ["websocket", "polling"],
};
const resolvedSocketConfig = socketConfig as ManagerOptions & SocketOptions;

export { SOCKET_URL } from "./config";

export const getSocket = (): Socket => {
  if (!socketInstance) {
    const target = SOCKET_URL ?? BACKEND_ORIGIN;
    socketInstance = io(target, resolvedSocketConfig);
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
