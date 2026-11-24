import { BchRpc } from './bch/BchRpc';
import { BtcRpc } from './btc/BtcRpc';
import { DogeRpc } from './doge/DogeRpc';
import { Erc20Rpc } from './erc20/Erc20Rpc';
import { EthRpc } from './eth/EthRpc';
import { LndRpc } from './lnd/LndRpc';
import { LtcRpc } from './ltc/LtcRpc';
import { MaticRpc } from './matic/MaticRpc';
import { SolRpc } from './sol/SolRpc';
import { SplRpc } from './sol/SplRpc';
import { XrpRpc } from './xrp/XrpRpc';

/** Any chain or token client CryptoRpc can hold */
export type ChainRpc = BtcRpc | BchRpc | DogeRpc | LtcRpc | LndRpc | XrpRpc | EthRpc | MaticRpc | Erc20Rpc | SolRpc | SplRpc;

export interface TokenConfig {
  /** Token standard, e.g. 'ERC20' or 'SPL' */
  type: string;
  [key: string]: any;
}

export interface CryptoRpcConfig {
  /** The chain to connect to, e.g. 'BTC', 'ETH', 'SOL' */
  chain: string;
  /** Treat an unlisted chain as EVM compatible and use the ETH client */
  isEVM?: boolean;
  /** e.g. 'http', 'https', 'ws', or 'wss' */
  protocol?: string;
  host?: string;
  port?: number | string;
  /** Used as port when port is not set */
  rpcPort?: number | string;
  user?: string;
  /** Used as user when user is not set */
  rpcUser?: string;
  pass?: string;
  /** Used as pass when pass is not set */
  rpcPass?: string;
  /** Token clients to build alongside the chain client, keyed by currency */
  tokens?: { [currency: string]: TokenConfig };
  /** Chain-specific settings are passed through to the client */
  [key: string]: any;
}

/**
 * Arguments for the dispatching methods. currency picks the client (the
 * configured chain when omitted); the rest goes to that client's method.
 */
export interface CurrencyParams {
  currency?: string;
  [key: string]: any;
}

const RpcClasses = {
  BTC: BtcRpc,
  BCH: BchRpc,
  ETH: EthRpc,
  XRP: XrpRpc,
  DOGE: DogeRpc,
  LTC: LtcRpc,
  LNBTC: LndRpc,
  MATIC: MaticRpc, // keeping for backwards compatibility 
  SOL: SolRpc,
};

const TokenClasses = {
  ETH: {
    native: EthRpc,
    ERC20: Erc20Rpc
  },
  MATIC: {
    native: MaticRpc,
    ERC20: Erc20Rpc
  },
  BTC: {
    native: BtcRpc
  },
  BCH: {
    native: BchRpc
  },
  XRP: {
    native: XrpRpc
  },
  DOGE: {
    native: DogeRpc
  },
  LTC: {
    native: LtcRpc
  },
  LNBTC: {
    native: LndRpc
  },
  SOL: {
    native: SolRpc,
    SPL: SplRpc
  }
};

export class CryptoRpc {
  chain: string;
  config: CryptoRpcConfig;
  rpcs: { [currency: string]: ChainRpc };

  /**
   * Constructor for CryptoRpcProvider class.
   * @param {Object} config - The configuration object.
   * @param {string} config.chain - The chain to connect to.
   * @param {boolean} [config.isEVM] - Optional flag indicating if the chain is EVM compatible.
   * @param {string} config.protocol - The protocol for RPC connection. e.g. 'http', 'https', 'ws', or 'wss'.
   * @param {string} config.host - The host address for RPC connection. e.g. 'localhost', 'x.x.x.x', or 'mydomain.com'.
   * @param {number} config.port - The port for RPC connection. e.g. 8332, 18332, 8545, 443, etc.
   * @param {string} [config.rpcPort] - The port for RPC connection (alternative).
   * @param {string} [config.user] - The username for authenticated RPC connection.
   * @param {string} [config.rpcUser] - The username for authenticated RPC connection (alternative).
   * @param {string} [config.pass] - The password for authenticated RPC connection.
   * @param {string} [config.rpcPass] - The password for authenticated RPC connection (alternative).
   * @param {Object} [config.tokens] - Optional tokens configuration.
   */
  constructor(config: CryptoRpcConfig) {
    this.chain = config.chain;
    if (!RpcClasses[this.chain] && !config.isEVM) {
      throw new Error('Invalid chain specified');
    }
    this.config = Object.assign({}, config, {
      host: config.host,
      port: config.port || config.rpcPort,
      user: config.user || config.rpcUser,
      pass: config.pass || config.rpcPass,
      protocol: config.protocol
    });
    const rpcChain = !config.isEVM ? this.chain : 'ETH';
    this.rpcs = {
      [this.chain]: new RpcClasses[rpcChain](this.config)
    };
    if (config.tokens) {
      for (const [token, tokenConfig] of Object.entries(config.tokens)) {
        const TokenClass = TokenClasses[rpcChain][tokenConfig.type];
        const configForToken = Object.assign(tokenConfig, this.config);
        this.rpcs[token] = new TokenClass(configForToken);
      }
    }
  }

  has(currency: string) {
    return !!this.rpcs[currency];
  }

  /**
   * Returns the client for a currency. The type parameter lets a caller who
   * knows the chain name its client, e.g. get<BtcRpc>('BTC').
   */
  get<T = any>(currency: string = this.chain): T {
    return this.rpcs[currency] as T;
  }

  cmdlineUnlock(params: CurrencyParams) {
    return this.get(params.currency).cmdlineUnlock(params);
  }

  getBalance(params: CurrencyParams) {
    return this.get(params.currency).getBalance(params);
  }

  sendToAddress(params: CurrencyParams) {
    return this.get(params.currency).sendToAddress(params);
  }

  walletLock(params: CurrencyParams) {
    return this.get(params.currency).walletLock(params);
  }

  unlockAndSendToAddress(params: CurrencyParams) {
    return this.get(params.currency).unlockAndSendToAddress(params);
  }

  unlockAndSendToAddressMany(params: CurrencyParams) {
    return this.get(params.currency).unlockAndSendToAddressMany(params);
  }

  estimateFee(params: CurrencyParams) {
    return this.get(params.currency).estimateFee(params);
  }

  estimateMaxPriorityFee(params: CurrencyParams) {
    const rpc = this.get(params.currency);
    return rpc.estimateMaxPriorityFee ? rpc.estimateMaxPriorityFee(params) : undefined;
  }

  getBestBlockHash(params: CurrencyParams) {
    return this.get(params.currency).getBestBlockHash(params);
  }

  getTransaction(params: CurrencyParams) {
    return this.get(params.currency).getTransaction(params);
  }

  getTransactions(params: CurrencyParams) {
    return this.get(params.currency).getTransactions(params);
  }

  getTransactionCount(params: CurrencyParams) {
    return this.get(params.currency).getTransactionCount(params);
  }

  getRawTransaction(params: CurrencyParams) {
    return this.get(params.currency).getRawTransaction(params);
  }

  sendRawTransaction(params: CurrencyParams) {
    return this.get(params.currency).sendRawTransaction(params);
  }

  decodeRawTransaction(params: CurrencyParams) {
    return this.get(params.currency).decodeRawTransaction(params);
  }

  getBlock(params: CurrencyParams) {
    return this.get(params.currency).getBlock(params);
  }

  getBlockHash(params: CurrencyParams) {
    return this.get(params.currency).getBlockHash(params);
  }

  getConfirmations(params: CurrencyParams) {
    return this.get(params.currency).getConfirmations(params);
  }

  getTip(params: CurrencyParams) {
    return this.get(params.currency).getTip(params);
  }

  getTxOutputInfo(params: CurrencyParams) {
    return this.get(params.currency).getTxOutputInfo(params);
  }

  validateAddress(params: CurrencyParams) {
    return this.get(params.currency).validateAddress(params);
  }

  getAccountInfo(params: CurrencyParams) {
    return this.get(params.currency).getAccountInfo(params);
  }

  getServerInfo(params: CurrencyParams) {
    return this.get(params.currency).getServerInfo(params);
  }
};