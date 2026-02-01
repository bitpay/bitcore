import { FeeMode } from './namespaces/ChainStateProvider';

export interface IChainConfig<T extends INetworkConfig> {
  [network: string]: T;
}

interface INetworkConfig {
  disabled?: boolean; // Disables P2P worker for this network
  module?: string; // Specific/custom module
  chainSource?: 'p2p' | 'external';
  trustedPeers: {
    host: string;
    port: number | string;
  }[];
  forkHeight?: number;
  parentChain?: string;
  syncStartHeight?: number; // Start syncing from this block height. Note: UTXO chains need both this + syncStartHash
}

export interface IUtxoNetworkConfig extends INetworkConfig {
  rpc: {
    host: string;
    port: number | string;
    username: string;
    password: string;
    protocol?: string;
  };
  defaultFeeMode?: FeeMode;
  syncStartHash?: string; // Start syncing from this block
}

export type ProviderDataType = 'realtime' | 'historical';

export interface IProvider {
  host: string;
  port?: number | string;
  protocol: 'http' | 'https' | 'ws' | 'wss' | 'ipc';
  options?: object;
  dataType?: ProviderDataType | 'combined';
  wsPort?: number | string;
  disabled?: boolean; // Useful when multiple providers are configured
}

export type IExternalSyncConfig<T> = {
  maxBlocksToSync?: number; // Max number of blocks to look back when starting the sync process
  syncIntervalSecs?: number; // Interval in seconds to check for new blocks
} & T;

export interface IEVMNetworkConfig extends INetworkConfig {
  client?: 'geth' | 'erigon'; // Note: Erigon support is not actively maintained
  providers?: IProvider[]; // Multiple providers can be configured to load balance for the syncing threads
  provider?: IProvider;
  gnosisFactory?: string; // Address of the gnosis multisig contract
  publicWeb3?: boolean; // Allow web3 rpc to be open via bitcore-node API endpoint
  threads?: number; // Defaults to your CPU's capabilities. Currently only available for EVM chains
  mtSyncTipPad?: number; // Default: 100. Multi-threaded sync will sync up to latest block height minus mtSyncTipPad. MT syncing is blind to reorgs. This helps ensure reorgs are accounted for near the tip.
  leanTransactionStorage?: boolean; // Removes data, abiType, internal and calls before saving a transaction to the databases
  needsL1Fee?: boolean; // Does this chain require a layer-1 fee to be added to a transaction (e.g. OP-stack chains)?
}

export interface IXrpNetworkConfig extends INetworkConfig {
  provider: IProvider & {
    dataHost: string;
  };
  startHeight: number;
  walletOnlySync: boolean;
}

export interface ISVMNetworkConfig extends INetworkConfig {
  publicConnection?: boolean; // Allow rpc connection to be open via bitcore-node API endpoint
  syncStartHeight?: number; // Start syncing from this block height
  providers?: IProvider[]; // Multiple providers can be configured to load balance for the syncing threads
  provider?: IProvider;
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
  dbReadPreference?: string;
  numWorkers: number;

  chains: {
    [chain: string]: IChainConfig<IUtxoNetworkConfig | IEVMNetworkConfig | IXrpNetworkConfig | ISVMNetworkConfig>;
  };
  aliasMapping: {
    chains: {
      [alias: string]: string;
    };
    networks: {
      [chain: string]: { [alias: string]: string };
    };
  };
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
  externalProviders?: {
    moralis: {
      apiKey: string;
      webhookBaseUrl?: string;
      streamSecret?: string;
      webhookCors?: object; // default: { origin: ['*'] }
    };
  };
}
