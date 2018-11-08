export type Protocol = 'BTC' | 'BCH';
export type Code = 'BTC' | 'BCH' | 'tBTC' | 'tBCH';
export type Network = 'mainnet' | 'testnet' | 'regtest';

export interface Chain {
  code: Code;
  name: string;
  network: Network;
  protocol: Protocol;
}

export const BCH: Chain = {
  code: 'BCH',
  name: 'Bitcoin Cash',
  network: 'mainnet',
  protocol: 'BCH'
};

export const tBCH: Chain = {
  code: 'tBCH',
  name: 'Bitcoin Cash Testnet',
  network: 'testnet',
  protocol: 'BCH'
};

export const BTC: Chain = {
  code: 'BTC',
  name: 'Bitcoin',
  network: 'mainnet',
  protocol: 'BTC'
};

export const tBTC: Chain = {
  code: 'tBTC',
  name: 'Bitcoin Testnet',
  network: 'testnet',
  protocol: 'BTC'
};

export const Chains = {
  BCH,
  tBCH,
  BTC,
  tBTC
};
