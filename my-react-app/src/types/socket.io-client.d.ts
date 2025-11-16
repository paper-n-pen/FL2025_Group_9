declare module "socket.io-client" {
  type Listener = (...args: any[]) => void;

  export interface Socket {
    id?: string;
    connected: boolean;
    emit(event: string, ...args: unknown[]): this;
    on(event: string, listener: Listener): this;
    once(event: string, listener: Listener): this;
    off(event: string, listener?: Listener): this;
    removeListener(event: string, listener: Listener): this;
    removeAllListeners(event?: string): this;
    disconnect(): this;
  }

  export interface ManagerOptions {
    [key: string]: any;
  }

  export interface SocketOptions {
    withCredentials?: boolean;
    transports?: string[];
    auth?: Record<string, unknown>;
    extraHeaders?: Record<string, string>;
    [key: string]: any;
  }

  export function io(
    uri: string,
    opts?: Partial<ManagerOptions & SocketOptions>
  ): Socket;

  export default io;
}
