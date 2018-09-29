export type Ticker = 'BTC' | 'BCH';
export type Network = 'mainnet' | 'testnet' | 'regtest';

export interface Chain {
  ticker: Ticker;
  network: Network;
}
export interface NetworkSettings {
  availableNetworks: Chain[];
  selectedNetwork: Chain;
}
