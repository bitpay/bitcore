export type BitcoinAddress = {
  toString: () => string;
};
export type BitcoinScript = {
  toBuffer: () => Buffer;
  classify: () => string;
  chunks: Array<{ buf: Buffer }>;
  toAddress: (network: string) => BitcoinAddress;
};
export type BitcoinInputObj = {
  prevTxId: string;
  outputIndex: number;
};
export type BitcoinInput = {
  toObject: () => BitcoinInputObj;
};
export type BitcoinOutput = {
  script: BitcoinScript;
  satoshis: number;
};
export type BitcoinTransactionType = {
  outputAmount: number;
  hash: string;
  _hash: undefined | string;
  isCoinbase: () => boolean;
  outputs: BitcoinOutput[];
  inputs: BitcoinInput[];
  toBuffer: () => Buffer;
  nLockTime: number;
};
