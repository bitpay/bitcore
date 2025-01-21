import { NetworkType } from './ChainNetwork';

export interface IFeeProvider {
  getFee(network: NetworkType, nblocks: number): Promise<number>;
};

export interface FeeCacheType {
  timestamp: number;
  response: any;
}

export interface SmartFeeResponse {
  feerate: number;
  blocks: number;
}
