export type Protocol = 'BTC' | 'XVG';
export type Code = 'BTC' | 'XVG' | 'tBTC' | 'tXVG';
export type Network = 'mainnet' | 'testnet' | 'regtest';

export interface Chain {
  code: Code;
  name: string;
  network: Network;
  protocol: Protocol;
}

export const XVG: Chain = {
  code: 'XVG',
  name: 'Bitcoin Cash',
  network: 'mainnet',
  protocol: 'XVG'
};

export const tXVG: Chain = {
  code: 'tXVG',
  name: 'Bitcoin Cash Testnet',
  network: 'testnet',
  protocol: 'XVG'
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
  XVG,
  tXVG,
  BTC,
  tBTC
};
