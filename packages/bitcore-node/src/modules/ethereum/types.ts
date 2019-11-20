import BN from 'bn.js';

import { IBlock } from '../../types/Block';
import { ClassifiedTrace, TokenTransferResponse } from './p2p/parityRpc';
import { ITransaction } from '../../models/baseTransaction';

export declare namespace Parity {
  export type Block = {
    author: string;
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
    sealFields: Array<string>;
    sha3Uncles: string;
    size: number;
    stateRoot: string;
    timestamp: number;
    totalDifficulty: string;
    transactions: Array<Transaction>;
    transactionsRoot: string;
    uncles: Array<string>;
  };
  export type Transaction = {
    blockHash: string;
    blockNumber: number;
    chainId: number;
    condition: number;
    creates: number;
    from: string;
    gas: number;
    gasPrice: string;
    hash: string;
    input: string;
    nonce: number;
    publicKey: string;
    r: string;
    raw: string;
    s: string;
    standardV: string;
    to: string;
    transactionIndex: number;
    v: string;
    value: string;
  };
}

export declare namespace Ethereum {
  export type Networks = 'mainnet' | 'ropsten' | 'rinkeby' | 'goerli' | 'kovan';

  export type Block = {
    header: Header;
    transactions: Transaction[];
    uncleHeaders: Header[];
    raw: Buffer[];
    txTrie: any;
  };

  export type Header = {
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
  };

  export type Transaction = {
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
  };
}

export type IEthBlock = IBlock & {
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

export type IEthTransaction = ITransaction & {
  data: Buffer;
  gasLimit: number;
  gasPrice: number;
  nonce: number;
  to: string;
  from: string;
  internal: Array<ClassifiedTrace>;
  transactionIndex: number;
  abiType?: {
    type: string;
    name: string;
    params: Array<{ name: string; value: string; type: string }>;
  };
  error?: string;
};

export type TransactionJSON = {
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
};

export type AbiDecodedData = { type: string; decodedData: TokenTransferResponse };
export type DecodedTrace = ClassifiedTrace & AbiDecodedData;
export type EthTransactionJSON = {
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
  abiType?: IEthTransaction['abiType'];
  decodedData?: AbiDecodedData;
  data: string;
  internal: Array<DecodedTrace>;
};
