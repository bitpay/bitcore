export interface IChainAdapter<B, T> {
  convertBlock(info: ChainInfo, block: B): CoreBlock;
  convertTx(info: ChainInfo, transaction: T, block?: B): CoreTransaction;
}

export type ChainInfo = {
  chain: string;
  network: string;
  parent?: {
    chain: string;
    height: number;
  };
}

export type CoreBlock = ChainInfo & {
  size: number;
  reward: number;
  header: {
    hash: string;
    prevHash: string;
    version: string;
    time: number;
    merkleRoot: string;
    bits: string;
    nonce: string;
  };
  transactions: CoreTransaction[];
}

export type CoreTransaction = ChainInfo & {
  hash: string;
  coinbase: boolean;
  nLockTime: number;
  inputs: {
    prevTxId: string;
    outputIndex: number;
  }[];
  outputs: {
    script: Buffer;
    satoshis: number;
  }[];
};
