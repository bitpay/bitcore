export type IBlock = {
  chain: string;
  network: string;
  height: number;
  hash: string;
  version: number;
  merkleRoot: string;
  time: Date;
  timeNormalized: Date;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  nonce: number | string;
  size: number;
  bits: number;
  reward: number;
  processed: boolean;
};

export type IBtcBlock = IBlock & {};
export type IEthBlock = IBlock & {
  nonce: string;
  gasLimit: number;
  gasUsed: number;
  stateRoot: Buffer;
};
