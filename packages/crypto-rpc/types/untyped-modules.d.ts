// Dependencies that ship no type declarations. These describe only the
// parts lib/ uses; RPC methods are generated at runtime, so the clients
// keep an open index signature for them.

declare module 'bitcoind-rpc' {
  namespace RpcClient {
    interface Options {
      protocol?: string;
      host?: string;
      port?: number | string;
      user?: string;
      pass?: string;
      disableAgent?: boolean;
      rejectUnauthorized?: boolean;
    }
  }

  class RpcClient {
    constructor(opts?: RpcClient.Options | string);
    // The constructor fills in defaults, but lib/btc/bitcoin.ts overwrites
    // them with the caller's values, which may be unset
    host?: string;
    port?: number | string;
    user?: string;
    pass?: string;
    // RPC methods are added to the prototype from a method spec at load time
    [method: string]: any;
  }

  export = RpcClient;
}

declare module 'dogecoind-rpc' {
  import RpcClient from 'bitcoind-rpc';

  export = RpcClient;
}

declare module 'promptly' {
  namespace promptly {
    type Callback = (err: Error | null, value: string) => void;

    interface Options {
      default?: string;
      trim?: boolean;
      validator?: ((value: string) => string) | Array<(value: string) => string>;
      retry?: boolean;
      silent?: boolean;
      replace?: string;
      input?: NodeJS.ReadableStream;
      output?: NodeJS.WritableStream;
    }

    function prompt(message: string, opts: Options, fn: Callback): void;
    function prompt(message: string, fn: Callback): void;
    function password(message: string, opts: Options, fn: Callback): void;
    function password(message: string, fn: Callback): void;
    function confirm(message: string, opts: Options, fn: (err: Error | null, value: boolean) => void): void;
    function confirm(message: string, fn: (err: Error | null, value: boolean) => void): void;
    function choose(message: string, choices: string[], opts: Options, fn: Callback): void;
    function choose(message: string, choices: string[], fn: Callback): void;
  }

  export = promptly;
}
