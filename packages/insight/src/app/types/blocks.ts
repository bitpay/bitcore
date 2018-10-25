export interface Block {
  readonly height: number;
  readonly size: number;
  readonly hash: string;
  readonly timestamp: number;
  readonly transactionCount: number;
  readonly poolName: string;
}

export interface InsightBlockObject {
  height?: number;
  size?: number;
  hash?: string;
  time?: number;
  txlength?: number;
  poolInfo?: {
    poolName?: string;
    url?: string;
  };
}

export interface ApiBlock {
  height: number;
  nonce: number;
  bits: number;
  size: number;
  confirmations: number;
  hash: string;
  merkleRoot: string;
  nextBlockHash: string;
  previousBlockHash: string;
  transactionCount: number;
  reward: number;
  minedBy: string;
  version: number;
  time: Date;
  timeNormalized: Date;
}

export interface AppBlock {
  height: number;
  merkleroot: string;
  nonce: number;
  size: number;
  confirmations: number;
  version: number;
  difficulty: number;
  bits: string;
  virtualSize: number;
  hash: string;
  time: number;
  tx: {
    length: number;
  };
  txlength: number;
  previousblockhash: string;
  nextblockhash: string;
  poolInfo: {
    poolName: string;
    url: string;
  };
  reward: number;
}
