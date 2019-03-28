export type IBlock = {
  chain: string;
  network: string;
  height: number;
  hash: string;
  merkleRoot: string;
  time: Date;
  timeNormalized: Date;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  nonce: number | string;
  version?: number;
  bits?: number;
  size: number;
  reward: number;
  processed: boolean;
};

export type IBtcBlock = IBlock & {
  version: number;
  bits: number;
};
export type IEthBlock = IBlock & {
  coinbase: string;
  nonce: string;
  gasLimit: number;
  gasUsed: number;
  stateRoot: Buffer;
};
