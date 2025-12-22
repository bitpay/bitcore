import { FeeMode } from './namespaces/ChainStateProvider';

export interface IChainConfig<T extends INetworkConfig> {
  [network: string]: T;
}

// TODO! NETWORK CONFIGURATION:
// Each network (mainnet, testnet, regtest) can be configured with different data sources.
// The 'chainSource' and 'module' fields determine how blockchain data is fetched.
interface INetworkConfig {
  disabled?: boolean; // Disables P2P worker for this network

  // TODO! MODULE SELECTION: Determines which chain state provider implementation to use
  // - undefined/not set: Use default provider (providers/chain-state/[chain]/)
  // - './moralis': Use Moralis external API provider (modules/moralis/api/csp.ts)
  // - './blockcypher': Use BlockCypher external API provider (FUTURE: modules/blockcypher/api/csp.ts)
  module?: string;

  // TODO! CHAIN SOURCE: Determines the PRIMARY data source for blockchain data
  // - 'p2p': Use local P2P node (fully self-hosted, syncs via peer network)
  // - 'external': Use external API exclusively (Moralis, BlockCypher, QuickNode, etc.)
  // - HYBRID MODE: Set to 'p2p' OR 'external' and configure multiple providers with different dataTypes
  //   The provider implementation (MoralisStateProvider) will route queries intelligently:
  //   - Queries for recent data: Uses provider with dataType='realtime' (local MongoDB)
  //   - Queries for historical data: Uses provider with dataType='historical' (external API)
  //   NOTE: Some configs use 'moralis' or 'rpc' as chainSource values (legacy/undocumented)
  chainSource?: 'p2p' | 'external';

  // TODO! TRUSTED PEERS: P2P network peers for blockchain synchronization
  // Used when chainSource='p2p' or in hybrid mode for recent block syncing
  trustedPeers: {
    host: string;
    port: number | string;
  }[];

  forkHeight?: number;
  parentChain?: string;

  // TODO! SYNC START HEIGHT: When syncing from P2P, start from this block
  // In hybrid mode: This defines the "recent data" boundary
  // Example: syncStartHeight = currentHeight - 90 days of blocks
  // - Blocks >= syncStartHeight: Synced via P2P, stored in local MongoDB
  // - Blocks < syncStartHeight: Fetched from external API on-demand
  syncStartHeight?: number; // Start syncing from this block height. Note: UTXO chains need both this + syncStartHash
}

// TODO! UTXO NETWORK CONFIGURATION:
// UTXO chains (Bitcoin, Litecoin, Dogecoin, Bitcoin Cash) currently use local P2P + RPC.
// FUTURE: Will support hybrid architecture similar to EVM (local + external API).
export interface IUtxoNetworkConfig extends INetworkConfig {
  // TODO! RPC for broadcasts and queries
  // In future hybrid mode: RPC used for broadcastTransaction, getBlockchainInfo, etc.
  // Query methods (getTransaction, streamAddressTransactions) can use external API
  rpc: {
    host: string;
    port: number | string;
    username: string;
    password: string;
    protocol?: string;
  };

  defaultFeeMode?: FeeMode;

  // TODO! SYNC START HASH: Hash of the block to start syncing from
  // In future hybrid mode: Defines boundary between local MongoDB and external API
  // Example: syncStartHash = hash of block from 90 days ago
  syncStartHash?: string; // Start syncing from this block

  // TODO! FUTURE: Add providers array for hybrid UTXO support
  // providers?: IProvider[]; // Will support BlockCypher, Blockchair for historical data
  // Example hybrid config:
  // providers: [
  //   { host: 'localhost', port: 8332, protocol: 'http', dataType: 'realtime' },  // Local Bitcoin node
  //   { host: 'api.blockcypher.com/v1/btc/main', protocol: 'https', dataType: 'historical' }  // BlockCypher API
  // ]
}

// TODO! HYBRID PROVIDER CONFIGURATION (CURRENTLY USED FOR EVM, FUTURE FOR UTXO):
// The IProvider interface supports both local nodes and external APIs.
// The 'dataType' field is the KEY to hybrid architecture - it tells the provider
// which data source to use for different query types.
//
// CURRENT STATE (EVM chains like BASE, OP):
// - Already using dataType for hybrid queries
// - See bitcore.config.json BASE.sepolia for real example
//
// dataType values:
// - 'realtime': Recent data (last 90 days) - typically local P2P node or RPC
//   * Used for queries where block height >= syncStartHeight
//   * Data stored in local MongoDB
// - 'historical': Older data (>90 days ago) - typically external indexed API (Moralis)
//   * Used for queries where block height < syncStartHeight
//   * Data fetched from external API on-demand (not stored locally)
// - 'combined': Provider handles both realtime and historical (single provider mode)
//   * All queries go to this provider regardless of block height
export interface IProvider {
  host: string;
  port?: number | string;
  protocol: 'http' | 'https' | 'ws' | 'wss' | 'ipc';
  options?: object;
  dataType?: 'realtime' | 'historical' | 'combined'; // TODO! KEY FIELD for hybrid query routing
  wsPort?: number | string;
  disabled?: boolean; // Useful when multiple providers are configured
}

export type IExternalSyncConfig<T> = {
  maxBlocksToSync?: number; // Max number of blocks to look back when starting the sync process
  syncIntervalSecs?: number; // Interval in seconds to check for new blocks
} & T;

// TODO! EVM NETWORK CONFIGURATION:
// EVM chains (Ethereum, Polygon, Arbitrum, BASE, Optimism) CURRENTLY support hybrid architecture.
// See bitcore.config.json for real examples (BASE.sepolia, OP.mainnet).
export interface IEVMNetworkConfig extends INetworkConfig {
  client?: 'geth' | 'erigon'; // Note: Erigon support is not actively maintained

  // TODO! HYBRID PROVIDER CONFIGURATION (CURRENTLY IN USE):
  // Multiple providers can be configured for load balancing OR hybrid data sourcing.
  // The 'dataType' field in each IProvider determines query routing.
  //
  // THREE MODES:
  // 1. LOAD BALANCING: Multiple providers with same dataType
  //    providers = [{ host: 'node1', dataType: 'combined' }, { host: 'node2', dataType: 'combined' }]
  //    Round-robin between nodes for all queries
  //
  // 2. HYBRID (LOCAL + EXTERNAL): Mix of provider dataTypes
  //    provider = { host: 'localhost:8545', protocol: 'ws', dataType: 'realtime' }
  //    providers = [{ host: 'site1.moralis-nodes.com', protocol: 'https', dataType: 'historical' }]
  //    MoralisStateProvider routes based on block height:
  //    - Recent blocks (>= syncStartHeight): Uses 'realtime' provider (local MongoDB)
  //    - Old blocks (< syncStartHeight): Uses 'historical' provider (Moralis API)
  //
  // 3. EXTERNAL-ONLY: Single provider with dataType 'combined' or 'historical'
  //    provider = { host: 'moralis.api', dataType: 'combined' }
  //    All queries go to external API
  //
  // REAL EXAMPLE: See bitcore.config.json → BASE.sepolia
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
  // TODO! EXTERNAL API CREDENTIALS:
  // This section stores API keys and configuration for external blockchain data providers.
  // Each provider (Moralis, BlockCypher, Blockchair, etc.) has its own config structure.
  // These are referenced by the chain state provider modules (modules/moralis, modules/blockcypher, etc.)
  externalProviders?: {
    moralis?: {
      apiKey: string;
      webhookBaseUrl?: string;
      streamSecret?: string;
      webhookCors?: object; // default: { origin: ['*'] }
    };
    // TODO! FUTURE: Add BlockCypher configuration for UTXO chains (BTC, LTC, DOGE, BCH)
    // blockcypher?: {
    //   apiKey: string;
    //   rateLimit?: number; // Requests per second
    // };
    // TODO! FUTURE: Add Blockchair configuration as alternative UTXO provider
    // blockchair?: {
    //   apiKey?: string; // Optional - they have a free tier
    // };
    // TODO! FUTURE: Add other EVM providers as alternatives to Moralis
    // alchemy?: {
    //   apiKey: string;
    // };
  };
}
