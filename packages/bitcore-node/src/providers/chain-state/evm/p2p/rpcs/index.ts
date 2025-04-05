import Web3 from 'web3';
import { ErigonBlock, GethBlock, IEVMBlock, IEVMTransactionInProcess } from '../../types';
import { ClassifiedTrace, ErigonRPC } from './erigonRpc';
import { GethRPC, IGethTxTrace } from './gethRpc';

export const Rpcs = {
  geth: GethRPC,
  erigon: ErigonRPC
};

export interface Callback<ResultType> {
  (error: Error): void;
  (error: null, val: ResultType): void;
}

export interface IJsonRpcRequest {
  jsonrpc: string;
  method: string;
  params: any[];
  id: number;
}

export interface IJsonRpcResponse {
  jsonrpc: string;
  id: number;
  result?: any;
  error?: string;
}

export interface IRpc {
  web3: Web3;
  getBlock(blockNumber: number): Promise<ErigonBlock | GethBlock>;
  getTransactionsFromBlock(blockNumber: number): Promise<Array<ClassifiedTrace | IGethTxTrace>>;
  send<T>(data: IJsonRpcRequest): Promise<T>;
  reconcileTraces(block: IEVMBlock, transactions: IEVMTransactionInProcess[], traces: Array<ClassifiedTrace | IGethTxTrace>);
}
