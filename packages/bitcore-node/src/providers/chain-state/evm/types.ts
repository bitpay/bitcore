import BN from 'bn.js';

import { ITransaction } from '../../../models/baseTransaction';
import { IBlock } from '../../../types/Block';
import { ClassifiedTrace } from './p2p/rpcs/erigonRpc';
import { IGethTxTraceFlat } from './p2p/rpcs/gethRpc';

interface BaseBlock {
  difficulty: string;
  extraData: string;
  gasLimit: number;
  gasUsed: number;
  hash: string;
  logsBloom: string;
  miner: string;
  mixHash: string;
  nonce: string;
  number: number;
  parentHash: string;
  receiptsRoot: string;
  sha3Uncles: string;
  size: number;
  stateRoot: string;
  timestamp: number | string;
  totalDifficulty: string;
  transactionsRoot: string;
  uncles: string[];
}

interface BaseTransaction {
  blockHash: string;
  blockNumber: number;
  from: string;
  gas: number;
  gasPrice: string;
  hash: string;
  input: string;
  nonce: number;
  r: string;
  s: string;
  to: string;
  transactionIndex: number;
  type: number;
  v: string;
  value: string;
}

/**
 * ERIGON
 */
export interface ErigonBlock extends BaseBlock {
  author: string;
  sealFields: Array<string>;
  transactions: ErigonTransaction[];
}

export interface ErigonTransaction extends BaseTransaction {
  chainId: number;
  condition: number;
  creates: number;
  publicKey: string;
  raw: string;
  standardV: string;
}

/**
 * GETH
 */
export interface GethBlock extends BaseBlock {
  transactions: GethTransaction[];
}

export interface GethTransaction extends BaseTransaction {
  type: number;
}

export interface GethTraceTransaction extends GethTransaction {
  calls: GethTraceCall[];
}

export interface GethTraceCall {
  calls?: GethTraceCall[];
  from: string;
  gas: string;
  gasUsed: string;
  input: string;
  output: string;
  to: string;
  type: 'CALL' | 'STATICCALL' | 'DELEGATECALL' | 'CREATE' | 'CREATE2';
  value?: string;
}

export type AnyBlock = GethBlock | ErigonBlock;
export type AnyTransaction = GethTraceTransaction | ErigonTransaction;

export type Networks = 'mainnet' | 'ropsten' | 'rinkeby' | 'goerli' | 'kovan' | 'sepolia' | 'mumbai';

export interface EVMBlock {
  header: EVMHeader;
  transactions: Transaction[];
  uncleHeaders: EVMHeader[];
  raw: Buffer[];
  txTrie: any;
}

export interface EVMHeader {
  parentHash: Buffer;
  uncleHash: Buffer;
  coinbase: Buffer;
  stateRoot: Buffer;
  transactionsTrie: Buffer;
  receiptTrie: Buffer;
  bloom: Buffer;
  difficulty: Buffer;
  number: Buffer;
  gasLimit: Buffer;
  gasUsed: Buffer;
  timestamp: Buffer;
  extraData: Buffer;
  mixHash: Buffer;
  nonce: Buffer;
  raw: Array<Buffer>;
  hash: () => Buffer;
}

export interface Transaction {
  hash: () => Buffer;
  nonce: Buffer;
  gasPrice: Buffer;
  gasLimit: Buffer;
  to: Buffer;
  from: Buffer;
  value: Buffer;
  data: Buffer;
  // EIP 155 chainId - mainnet: 1, ropsten: 3
  chainId: number;
  getUpfrontCost: () => BN;
}

export type IEVMBlock = IBlock & {
  coinbase: Buffer;
  nonce: Buffer;
  gasLimit: number;
  gasUsed: number;
  stateRoot: Buffer;
  logsBloom: Buffer;
  sha3Uncles: Buffer;
  receiptsRoot: Buffer;
  merkleRoot: Buffer;
  uncleReward?: Array<number>;
  difficulty: string;
  totalDifficulty: string;
};

export type IEVMTransaction = ITransaction & {
  gasLimit: number;
  gasPrice: number;
  nonce: number;
  to: string;
  from: string;
  transactionIndex: number;
  error?: string;
  receipt?: TxReceipt;
  effects?: Effect[] // Meant to replace abiType, internal, calls and data on stored txs
};

export interface Effect {
  to: string,
  from: string,
  amount: string,
  type?: 'ERC20:transfer' | 'MULTISIG:submitTransaction' | 'MULTISIG:confirmTransaction' // These are the only txs types we care about
  contractAddress?: string,
  callStack?: string
}

export type IEVMTransactionInProcess = IEVMTransaction & {
  data: Buffer;
  internal: Array<ClassifiedTrace>;
  calls: Array<IGethTxTraceFlat>;
  abiType?: IAbiDecodedData;
};

export interface TxReceipt {
  status: boolean;
  transactionHash: string;
  transactionIndex: number;
  blockHash: string;
  blockNumber: number;
  contractAddress?: string;
  cumulativeGasUsed: number;
  gasUsed: number;
  logs: Array<any>;
}

export type IEVMTransactionTransformed = IEVMTransactionInProcess & {
  initialFrom?: string;
  callStack?: string;
};

export interface TransactionJSON {
  txid: string;
  chain: string;
  network: string;
  blockHeight: number;
  blockHash?: string;
  blockTime: string;
  blockTimeNormalized: string;
  fee: number;
  size: number;
  value: number;
}

export interface IAbiDecodeResponse {
  name: string;
  params: Array<{ name: string; value: string; type: string }>;
}

export interface IAbiDecodedData extends IAbiDecodeResponse {
  type: string;
}
export type DecodedTrace = ClassifiedTrace & {
  decodedData?: IAbiDecodedData;
};

export interface ParsedAbiParams {
  [key: string]: string
}

export interface EVMTransactionJSON {
  txid: string;
  chain: string;
  network: string;
  blockHeight: number;
  blockHash: string;
  blockTime: string;
  blockTimeNormalized: string;
  fee: number;
  value: number;
  gasLimit: number;
  gasPrice: number;
  nonce: number;
  to: string;
  from: string;
  abiType?: IAbiDecodedData;
  data?: string;
  internal?: Array<DecodedTrace>;
  calls?: Array<IGethTxTraceFlat>;
  receipt?: TxReceipt;
  effects?: Effect[];
}

export interface EventLog<T> {
  event: string;
  address: string;
  returnValues: T;
  logIndex: number;
  transactionIndex: number;
  transactionHash: string;
  blockHash: string;
  blockNumber: number;
  raw?: { data: string; topics: any[] };
}
export interface ERC20Transfer
  extends EventLog<{
    [key: string]: string;
  }> {}

  export interface IEVMCachedAddress {
    address: string;
    tokenAddress?: string;
  }