export interface IChainConfig<T extends INetworkConfig> {
  [network: string]: T;
}

interface INetworkConfig {
  disabled?: boolean;
  chainSource?: 'p2p';
  trustedPeers: {
    host: string;
    port: number | string;
  }[];
  forkHeight?: number;
  parentChain?: string;
}

export interface IUtxoNetworkConfig extends INetworkConfig {
  rpc: {
    host: string;
    port: number | string;
    username: string;
    password: string;
  };
}

interface IProvider {
  host: string;
  port?: number | string;
  protocol: 'http' | 'https' | 'ws' | 'wss' | 'ipc';
  options?: object;
}

export interface IEVMNetworkConfig extends INetworkConfig {
  client?: 'geth' | 'erigon'; // Note: Erigon support is not actively maintained
  providers?: IProvider[]; // Multiple providers can be configured to load balance for the syncing threads
  provider?: IProvider;
  gnosisFactory?: string; // Address of the gnosis multisig contract
  publicWeb3?: boolean; // Allow web3 rpc to be open via bitcore-node API endpoint
  syncStartHeight?: number;
  threads?: number; // Defaults to your CPU's capabilities. Currently only available for ETH
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
    [currency: string]: IChainConfig<IUtxoNetworkConfig | IEVMNetworkConfig | IXrpNetworkConfig>;
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
