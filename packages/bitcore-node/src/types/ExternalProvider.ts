import { MongoBound } from '../models/base';
import { IEVMTransaction } from '../providers/chain-state/evm/types';
import { ExternalApiStream } from '../providers/chain-state/external/streams/apiStream';
import { ChainId } from './ChainNetwork';
import { StreamAddressUtxosParams, StreamTransactionParams } from './namespaces/ChainStateProvider';

export interface IExternalProvider {
  getBlockNumberByDate(params: { date: Date | string } & ChainId): Promise<number>;
  getTransaction(params: StreamTransactionParams & ChainId): Promise<MongoBound<IEVMTransaction>|undefined>;
  streamAddressTransactions(params: StreamAddressUtxosParams & ChainId): Promise<ExternalApiStream>;
}