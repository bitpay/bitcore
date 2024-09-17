import { ChainNetwork } from '../../types/ChainNetwork';
import {
  BroadcastTransactionParams,
  ChainStateServices,
  CreateWalletParams,
  DailyTransactionsParams,
  GetBalanceForAddressParams,
  GetBlockBeforeTimeParams,
  GetBlockParams,
  GetEstimatePriorityFeeParams,
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
  get({ chain, network }: ChainNetwork) {
    if (services[chain]?.[network] == undefined) {
      throw new Error(`Chain ${chain}:${network} doesn't have a ChainStateProvider registered`);
    }
    return services[chain][network];
  }

  streamAddressUtxos(params: StreamAddressUtxosParams) {
    return this.get(params).streamAddressUtxos(params);
  }

  streamAddressTransactions(params: StreamAddressUtxosParams) {
    return this.get(params).streamAddressTransactions(params);
  }

  async getBalanceForAddress(params: GetBalanceForAddressParams) {
    return this.get(params).getBalanceForAddress(params);
  }

  async getBlock(params: GetBlockParams) {
    return this.get(params).getBlock(params);
  }

  async getBlockBeforeTime(params: GetBlockBeforeTimeParams) {
    return this.get(params).getBlockBeforeTime(params);
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
    return this.get(params).createWallet(params);
  }

  async getWallet(params: GetWalletParams) {
    return this.get(params).getWallet(params);
  }

  streamWalletAddresses(params: StreamWalletAddressesParams) {
    return this.get(params).streamWalletAddresses(params);
  }

  walletCheck(params: WalletCheckParams) {
    return this.get(params).walletCheck(params);
  }

  async updateWallet(params: UpdateWalletParams) {
    return this.get(params).updateWallet(params);
  }

  streamWalletTransactions(params: StreamWalletTransactionsParams) {
    return this.get(params).streamWalletTransactions(params);
  }

  async getWalletBalance(params: GetWalletBalanceParams) {
    return this.get(params).getWalletBalance(params);
  }

  async getWalletBalanceAtTime(params: GetWalletBalanceAtTimeParams) {
    return this.get(params).getWalletBalanceAtTime(params);
  }

  async getFee(params: GetEstimateSmartFeeParams) {
    return this.get(params).getFee(params);
  }

  async getPriorityFee(params: GetEstimatePriorityFeeParams) {
    return this.get(params).getPriorityFee?.(params);
  }

  streamWalletUtxos(params: StreamWalletUtxosParams) {
    return this.get(params).streamWalletUtxos(params);
  }

  async broadcastTransaction(params: BroadcastTransactionParams) {
    return this.get(params).broadcastTransaction(params);
  }

  registerService(chain: string, network: string, service: IChainStateService) {
    services[chain] = services[chain] || {}
    services[chain][network] = service;
  }

  async getCoinsForTx(params: { chain: string; network: string; txid: string }) {
    return this.get(params).getCoinsForTx(params);
  }

  async getLocalTip(params) {
    return this.get(params).getLocalTip(params);
  }

  async getLocatorHashes(params) {
    return this.get(params).getLocatorHashes(params);
  }

  streamMissingWalletAddresses(params) {
    return this.get(params).streamMissingWalletAddresses(params);
  }

  isValid(params) {
    return this.get(params).isValid(params);
  }
}
export let ChainStateProvider = new ChainStateProxy();
