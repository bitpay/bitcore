export type BtcNetworks = 'mainnet' | 'testnet3' | 'testnet4' | 'regtest';

export type NetworkType = 'mainnet' | 'testnet' | 'regtest' | BtcNetworks;

export interface Chain {
  chain: string;
}
export interface Network {
  network: string; // TODO change this to NetworkType
}
export type ChainNetwork = Chain & Network;

export interface ChainId { chainId: string | bigint }
