const crypto = require('crypto');
import { Chain } from '../../types/ChainNetwork';
import {
  BroadcastTransactionParams,
  ChainStateServices,
  CreateWalletParams,
  DailyTransactionsParams,
  GetBalanceForAddressParams,
  GetBlockBeforeTimeParams,
  GetBlockParams,
  GetEstimateSmartFeeParams,
  GetWalletBalanceAtTimeParams,
  GetWalletBalanceParams,
  GetWalletParams,
  IChainStateProvider,
  IChainStateService,
  StreamAddressUtxosParams,
  StreamBlocksParams,
  StreamTransactionParams,
  StreamTransactionsParams,
  StreamWalletAddressesParams,
  StreamWalletTransactionsParams,
  StreamWalletUtxosParams,
  UpdateWalletParams,
  WalletCheckParams
} from '../../types/namespaces/ChainStateProvider';

const services: ChainStateServices = {};

class ChainStateProxy implements IChainStateProvider {
  requestCache: any;
  constructor() {
    this.requestCache = {};
  }

  private coalesceRequest(params: any, method: any) {
    const getCaller = () => {
      const stack = (new Error()).stack;
      if (!stack) {
        throw new Error('Unable to determine caller');
      }
      return stack.split("\n")[3].trim().split(" ")[1];
    }
    let requestKey = getCaller() + JSON.stringify(params);
    requestKey = crypto
      .createHash('sha256')
      .update(requestKey)
      .digest('hex');
    if (!this.requestCache[requestKey]) {
      this.requestCache[requestKey] = method(params);
    }
    const cleanup = (err, result) => {
      delete this.requestCache[requestKey];
      if (err) {
        return Promise.reject(err);
      };
      return Promise.resolve(result)
    };
    return this.requestCache[requestKey].then(
      (result) => cleanup(null, result),
      err => cleanup(err, null)
    );
  }

  get({ chain }: Chain) {
    if (services[chain] == undefined) {
      throw new Error(`Chain ${chain} doesn't have a ChainStateProvider registered`);
    }
    return services[chain];
  }

  streamAddressUtxos(params: StreamAddressUtxosParams) {
    return this.get(params).streamAddressUtxos(params);
  }

  streamAddressTransactions(params: StreamAddressUtxosParams) {
    return this.get(params).streamAddressTransactions(params);
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams) {
    return this.coalesceRequest(params, this.get(params).getBalanceForAddress);
  }

  async getBlock(params: GetBlockParams) {
    return this.coalesceRequest(params, this.get(params).getBlock);
  }

  async getBlockBeforeTime(params: GetBlockBeforeTimeParams) {
    return this.coalesceRequest(params, this.get(params).getBlockBeforeTime);
  }

  streamBlocks(params: StreamBlocksParams) {
    return this.get(params).streamBlocks(params);
  }

  streamTransactions(params: StreamTransactionsParams) {
    return this.get(params).streamTransactions(params);
  }

  getAuthhead(params: StreamTransactionParams) {
    return this.get(params).getAuthhead(params);
  }

  getDailyTransactions(params: DailyTransactionsParams) {
    return this.get(params).getDailyTransactions(params);
  }

  getTransaction(params: StreamTransactionParams) {
    return this.get(params).getTransaction(params);
  }

  async createWallet(params: CreateWalletParams) {
    return this.coalesceRequest(params, this.get(params).createWallet);
  }

  async getWallet(params: GetWalletParams) {
    return this.coalesceRequest(params, this.get(params).getWallet);
  }

  streamWalletAddresses(params: StreamWalletAddressesParams) {
    return this.get(params).streamWalletAddresses(params);
  }

  walletCheck(params: WalletCheckParams) {
    return this.coalesceRequest(params, this.get(params).walletCheck);
  }

  async updateWallet(params: UpdateWalletParams) {
    return this.coalesceRequest(params, this.get(params).updateWallet);
  }

  streamWalletTransactions(params: StreamWalletTransactionsParams) {
    return this.get(params).streamWalletTransactions(params);
  }

  async getWalletBalance(params: GetWalletBalanceParams) {
    return this.coalesceRequest(params, this.get(params).getWalletBalance);
  }

  async getWalletBalanceAtTime(params: GetWalletBalanceAtTimeParams) {
    return this.coalesceRequest(params, this.get(params).getWalletBalanceAtTime);
  }

  async getFee(params: GetEstimateSmartFeeParams) {
    return this.coalesceRequest(params, this.get(params).getFee);
  }

  streamWalletUtxos(params: StreamWalletUtxosParams) {
    return this.get(params).streamWalletUtxos(params);
  }

  async broadcastTransaction(params: BroadcastTransactionParams) {
    return this.coalesceRequest(params, this.get(params).broadcastTransaction);
  }

  registerService(currency: string, service: IChainStateService) {
    services[currency] = service;
  }

  async getCoinsForTx(params: { chain: string; network: string; txid: string }) {
    return this.coalesceRequest(params, this.get(params).getCoinsForTx);
  }

  async getLocalTip(params) {
    return this.coalesceRequest(params, this.get(params).getLocalTip);
  }

  async getLocatorHashes(params) {
    return this.coalesceRequest(params, this.get(params).getLocatorHashes);
  }

  streamMissingWalletAddresses(params) {
    return this.get(params).streamMissingWalletAddresses(params);
  }

  isValid(params) {
    return this.get(params).isValid(params);
  }
}
export let ChainStateProvider = new ChainStateProxy();
