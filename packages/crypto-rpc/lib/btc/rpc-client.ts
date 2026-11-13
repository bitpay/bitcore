// bitcoind-rpc and dogecoind-rpc ship no type declarations, and the ones in
// types/ aren't published. The clients are typed through these local
// interfaces so the emitted .d.ts files never import those packages.

export interface BitcoindRpcClientOptions {
  protocol?: string;
  host?: string;
  port?: number | string;
  user?: string;
  pass?: string;
  disableAgent?: boolean;
  rejectUnauthorized?: boolean;
}

export interface BitcoindRpcClient {
  host?: string;
  port?: number | string;
  user?: string;
  pass?: string;
  // RPC methods are added to the prototype from a method spec at load time
  [method: string]: any;
}

export type BitcoindRpcClientConstructor = new (opts?: BitcoindRpcClientOptions | string) => BitcoindRpcClient;
