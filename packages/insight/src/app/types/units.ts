import { BCH, BTC, Chain, tBCH, tBTC } from './chains';

export interface ChainDenomination {
  [k: string]: Unit;
}

export interface Unit {
  code: string;
  name: string;
  rate: number;
}

export type RateListing = Unit[];

const generateBitcoinDenomination = (chain: Chain): ChainDenomination => ({
  [chain.code]: {
    code: chain.code,
    name: chain.name,
    rate: 1
  },
  [`${chain.code}Bits`]: {
    code: `${chain.code}_bits`,
    name: `Bits (${chain.code})`,
    rate: 1_000_000
  },
  [`${chain.code}Satoshis`]: {
    code: `${chain.code}_satoshis`,
    name: `Satoshis (${chain.code})`,
    rate: 100_000_000
  }
});

export const BCHDenomination = generateBitcoinDenomination(BCH);
export const tBCHDenomination = generateBitcoinDenomination(tBCH);
export const BTCDenomination = generateBitcoinDenomination(BTC);
export const tBTCDenomination = generateBitcoinDenomination(tBTC);

export const ChainDenominations = {
  BCH: BCHDenomination,
  tBCH: tBCHDenomination,
  BTC: BTCDenomination,
  tBTC: tBTCDenomination
};
