declare module "socket.io-client" {
  type Listener = (...args: unknown[]) => void;

  export interface Socket {
    connected: boolean;
    emit(event: string, ...args: unknown[]): void;
    on(event: string, listener: Listener): this;
    once(event: string, listener: Listener): this;
    off(event: string, listener?: Listener): this;
    removeAllListeners(event?: string): this;
    disconnect(): this;
  }

  export interface ManagerOptions {
    [key: string]: unknown;
  }

  export interface SocketOptions {
    withCredentials?: boolean;
    [key: string]: unknown;
  }

  export function io(
    uri: string,
    opts?: Partial<ManagerOptions & SocketOptions>
  ): Socket;

  export default io;
}
