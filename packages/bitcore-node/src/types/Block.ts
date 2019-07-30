export type IBlock = {
  chain: string;
  confirmations?: number;
  network: string;
  height: number;
  hash: string;
  merkleRoot: string;
  time: Date;
  timeNormalized: Date;
  nonce: string | number;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  size: number;
  reward: number;
  processed: boolean;
};
