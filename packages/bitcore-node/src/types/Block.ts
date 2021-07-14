export interface IBlock {
  chain: string;
  confirmations?: number;
  network: string;
  height: number;
  hash: string;
  time: Date;
  timeNormalized: Date;
  previousBlockHash: string;
  nextBlockHash: string;
  transactionCount: number;
  size: number;
  reward: number;
  processed: boolean;
}
