export interface Chain {
  chain: string;
}
export interface Network {
  network: string;
}
export type ChainNetwork = Chain & Network;
