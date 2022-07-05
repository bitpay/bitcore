import Web3 from 'web3';
import { GethRPC } from './gethRpc';
import { ParityRPC } from './parityRpc';

export const Rpcs = {
  geth: GethRPC,
  parity: ParityRPC
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
  getBlock(blockNumber: number);
  getTransactionsFromBlock(blockNumber: number): Promise<Array<any>>;
  send<T>(data: IJsonRpcRequest): Promise<T>;
}
