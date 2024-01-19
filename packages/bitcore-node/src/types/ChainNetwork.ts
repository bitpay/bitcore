export type NetworkType = 'mainnet' | 'testnet' | 'regtest';

export interface Chain {
  chain: string;
}
export interface Network {
  network: string; // TODO change this to NetworkType
}
export type ChainNetwork = Chain & Network;
