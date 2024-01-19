import { NetworkType } from "./ChainNetwork";

export interface IFeeProvider {
  getFee(network: NetworkType, nblocks: number): Promise<number>;
};

export type FeeCacheType = {
  timestamp: number;
  response: any;
};

export type SmartFeeResponse = {
  feerate: number;
  blocks: number;
};
