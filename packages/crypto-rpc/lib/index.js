import { BchRpc } from './bch/BchRpc.js';
import { BtcRpc } from './btc/BtcRpc.js';
import { DogeRpc } from './doge/DogeRpc.js';
import { Erc20Rpc } from './erc20/Erc20Rpc.js';
import { EthRpc } from './eth/EthRpc.js';
import { LndRpc } from './lnd/LndRpc.js';
import { LtcRpc } from './ltc/LtcRpc.js';
import { MaticRpc } from './matic/MaticRpc.js';
import { SolRpc } from './sol/SolRpc.js';
import { SplRpc } from './sol/SplRpc.js';
import { XrpRpc } from './xrp/XrpRpc.js';

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
  constructor(config) {
    const chain = config.chain;
    if (!RpcClasses[chain] && !config.isEVM) {
      throw new Error('Invalid chain specified');
    }
    const _config = Object.assign({}, config, {
      host: config.host,
      port: config.port || config.rpcPort,
      user: config.user || config.rpcUser,
      pass: config.pass || config.rpcPass,
      protocol: config.protocol
    });
    const rpcChain = !config.isEVM ? chain : 'ETH';
    this.rpcs = {
      [chain]: new RpcClasses[rpcChain](_config)
    };
    if (config.tokens) {
      for (const [token, tokenConfig] of Object.entries(config.tokens)) {
        const TokenClass = TokenClasses[rpcChain][tokenConfig.type];
        const configForToken = Object.assign(tokenConfig, _config);
        this.rpcs[token] = new TokenClass(configForToken);
      }
    }
  }

  has(currency) {
    return !!this.rpcs[currency];
  }

  get(currency = this.chain) {
    return this.rpcs[currency];
  }

  cmdlineUnlock(params) {
    return this.get(params.currency).cmdlineUnlock(params);
  }

  getBalance(params) {
    return this.get(params.currency).getBalance(params);
  }

  sendToAddress(params) {
    return this.get(params.currency).sendToAddress(params);
  }

  walletLock(params) {
    return this.get(params.currency).walletLock(params);
  }

  unlockAndSendToAddress(params) {
    return this.get(params.currency).unlockAndSendToAddress(params);
  }

  unlockAndSendToAddressMany(params) {
    return this.get(params.currency).unlockAndSendToAddressMany(params);
  }

  estimateFee(params) {
    return this.get(params.currency).estimateFee(params);
  }

  estimateMaxPriorityFee(params) {
    const rpc = this.get(params.currency);
    return rpc.estimateMaxPriorityFee ? rpc.estimateMaxPriorityFee(params) : undefined;
  }

  getBestBlockHash(params) {
    return this.get(params.currency).getBestBlockHash(params);
  }

  getTransaction(params) {
    return this.get(params.currency).getTransaction(params);
  }

  getTransactions(params) {
    return this.get(params.currency).getTransactions(params);
  }

  getTransactionCount(params) {
    return this.get(params.currency).getTransactionCount(params);
  }

  getRawTransaction(params) {
    return this.get(params.currency).getRawTransaction(params);
  }

  sendRawTransaction(params) {
    return this.get(params.currency).sendRawTransaction(params);
  }

  decodeRawTransaction(params) {
    return this.get(params.currency).decodeRawTransaction(params);
  }

  getBlock(params) {
    return this.get(params.currency).getBlock(params);
  }

  getBlockHash(params) {
    return this.get(params.currency).getBlockHash(params);
  }

  getConfirmations(params) {
    return this.get(params.currency).getConfirmations(params);
  }

  getTip(params) {
    return this.get(params.currency).getTip(params);
  }

  getTxOutputInfo(params) {
    return this.get(params.currency).getTxOutputInfo(params);
  }

  validateAddress(params) {
    return this.get(params.currency).validateAddress(params);
  }

  getAccountInfo(params) {
    return this.get(params.currency).getAccountInfo(params);
  }

  getServerInfo(params) {
    return this.get(params.currency).getServerInfo(params);
  }
};