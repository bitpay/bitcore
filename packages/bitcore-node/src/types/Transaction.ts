import { ObjectID } from 'mongodb';
export type ITransaction = {
  txid: string;
  chain: string;
  network: string;
  blockHeight: number;
  blockHash?: string;
  blockTime?: Date;
  blockTimeNormalized?: Date;
  fee: number;
  size: number;
  value: number;
  wallets: ObjectID[];
};

export type IBtcTransaction = ITransaction & {
  locktime: number;
  inputCount: number;
  outputCount: number;
  coinbase: boolean;
};

export type IEthTransaction = ITransaction & {
  data: Buffer;
  gasLimit: number;
  gasPrice: number;
  nonce: number;
  to: string;
  from: string;
};


export type TransactionJSON = {
  _id: string;
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

export type BtcTransactionJSON = {
  _id: string;
  txid: string;
  chain: string;
  network: string;
  blockHeight: number;
  blockHash: string;
  blockTime: string;
  blockTimeNormalized: string;
  coinbase: boolean;
  fee: number;
  size: number;
  locktime: number;
  inputCount: number;
  outputCount: number;
  value: number;
};

export type EthTransactionJSON = {
  _id: string;
  txid: string;
  chain: string;
  network: string;
  blockHeight: number;
  blockHash: string;
  blockTime: string;
  blockTimeNormalized: string;
  fee: number;
  size: number;
  value: number;
  gasLimit: number;
  gasPrice: number;
  nonce: number;
  to: string;
  from: string;
};
