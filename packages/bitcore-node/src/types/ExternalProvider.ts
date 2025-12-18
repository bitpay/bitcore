import { MongoBound } from '../models/base';
import { CoinEvent } from '../models/events';
import { IEVMTransaction } from '../providers/chain-state/evm/types';
import { ExternalApiStream } from '../providers/chain-state/external/streams/apiStream';
import { ChainId, ChainNetwork } from './ChainNetwork';
import { StreamAddressUtxosParams, StreamTransactionParams } from './namespaces/ChainStateProvider';

export interface IAddressSubscription {
  id?: string;
  status?: string;
};

export interface IExternalProvider {
  getBlockNumberByDate(params: { date: Date | string } & ChainId): Promise<number>;
  getTransaction(params: StreamTransactionParams & ChainId): Promise<MongoBound<IEVMTransaction>|undefined>;
  streamAddressTransactions(params: StreamAddressUtxosParams & ChainId): Promise<ExternalApiStream>;
  
  // These may be moralis-specific. Once we add another provider,
  //  we'll need to see how they do subscriptions (might not be webhook-based)
  createAddressSubscription(params: ChainNetwork & ChainId): Promise<IAddressSubscription>;
  getAddressSubscriptions(): Promise<any>;
  deleteAddressSubscription(params: { sub: IAddressSubscription }): Promise<IAddressSubscription>;
  updateAddressSubscription(params: { sub: IAddressSubscription; addressesToAdd?: string[]; addressesToRemove?: string[]; status?: string }): Promise<IAddressSubscription>;
  webhookToCoinEvents(params: { webhook: any; tipHeight: number } & ChainNetwork): CoinEvent[];
};