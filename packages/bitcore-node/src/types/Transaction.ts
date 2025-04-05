export interface TransactionJSON {
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
  replacedByTxid?: string;
}
