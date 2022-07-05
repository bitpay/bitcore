export interface IChainConfig<T extends INetworkConfig> {
  [network: string]: T;
}

interface INetworkConfig {
  disabled?: boolean;
  chainSource?: 'p2p';
  sync?: {
    startHeight: number;
    threads: number;
  };
  trustedPeers: {
    host: string;
    port: number;
  }[];
}

export interface IUtxoNetworkConfig extends INetworkConfig {
  rpc: {
    host: string;
    port: number;
    username: string;
    password: string;
  };
}

interface IProvider {
  host: string;
  port?: string;
  protocol: 'http' | 'https' | 'ws' | 'wss' | 'ipc';
  options?: object;
}

export interface IEthNetworkConfig extends INetworkConfig {
  client?: 'geth' | 'parity' | 'erigon';
  providers?: IProvider[]; // mulitple providers can be configured to load balance for the syncing threads
  provider?: IProvider;
  forkHeight?: number;
  parentChain?: string;
}

export interface IXrpNetworkConfig extends INetworkConfig {
  provider: IProvider & {
    dataHost: string;
  };
  startHeight: number;
  walletOnlySync: boolean;
}

export interface ConfigType {
  maxPoolSize: number;
  port: number;
  dbUrl: string;
  dbHost: string;
  dbName: string;
  dbPort: string;
  dbUser: string;
  dbPass: string;
  numWorkers: number;

  chains: {
    [currency: string]: IChainConfig<IUtxoNetworkConfig | IEthNetworkConfig | IXrpNetworkConfig>;
  };
  modules?: string[];
  services: {
    api: {
      disabled?: boolean;
      rateLimiter?: {
        disabled?: boolean;
        whitelist: string[];
      };
      wallets?: {
        allowCreationBeforeCompleteSync?: boolean;
        allowUnauthenticatedCalls?: boolean;
      };
    };
    event: {
      disabled?: boolean;
      onlyWalletEvents: boolean;
    };
    p2p: {
      disabled?: boolean;
    };
    socket: {
      disabled?: boolean;
      bwsKeys: Array<string>;
    };
    storage: {
      disabled?: boolean;
    };
  };
}
