export type BitcoinAddress = {
  toString: (stripCash: boolean) => string;
};
export type BitcoinScript = {
  toBuffer: () => Buffer;
  toHex: () => string;
  classify: () => string;
  chunks: Array<{ buf: Buffer }>;
  toAddress: (network: string) => BitcoinAddress;
};
export type BitcoinInputObj = {
  prevTxId: string;
  outputIndex: number;
  sequenceNumber: number;
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
