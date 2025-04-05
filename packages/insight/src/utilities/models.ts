export interface ApiTransaction {
  txid: string;
  network: string;
  chain: string;
  blockHeight: number;
  blockHash: string;
  blockTime: string;
  blockTimeNormalized: string;
  fee: number;
  value: number;
  confirmations: number;
  coinbase: boolean;
}

export interface Transaction extends ApiTransaction {
  locktime: number;
  inputCount: number;
  outputCount: number;
  size: number;
  inputs: ApiCoin[];
  outputs: ApiCoin[];
}

export interface TransactionEth extends ApiTransaction {
  gasLimit: number;
  gasPrice: number;
  to: string;
  from: string;
  height?: number;
  nonce: number;
}

export interface ApiCoin {
  txid: string;
  mintTxid: string;
  coinbase: boolean;
  vout: number;
  address: string;
  script: {
    asm: string;
    type: string;
  };
  spentTxid: string;
  mintHeight: number;
  spentHeight: number;
  value: number;
  sequenceNumber: number;
}

export interface Coins {
  coins: any;
  inputs: ApiCoin[];
  outputs: ApiCoin[];
  version: number;
}

export interface CoinsListEth {
  to: string;
  from: string;
  txid: string;
  fee: number;
  value: number;
  blockHeight: number;
  height: number;
  blockTime: string;
  confirmations: number;
  coinbase?: boolean;
}

export interface CoinsList {
  height: number;
  value: number;
  confirmations: number;
  mintTxid?: string;
  spentTxid?: string;
}

export interface BlockTransactionDetails {
  inputs: any[];
  outputs: any[];
  isCoinBase: boolean;
  time: number;
  txid: string;
  valueOut: number;
}

export interface InputType {
  regexes: RegExp[];
  dataIndex?: number;
  type: string;
  chainNetworks: ChainNetwork[];
}

export interface ChainNetwork {
  chain: string;
  network: string;
}

export interface CryptoSearchInput {
  input: string;
  chainNetwork: ChainNetwork;
  type: string;
}

export interface BlocksType {
  height: number;
  transactionCount: number;
  time: string;
  size: number;
  hash: string;
}
