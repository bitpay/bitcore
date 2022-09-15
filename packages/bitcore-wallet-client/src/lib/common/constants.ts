'use strict';
import * as CWC from 'crypto-wallet-core';

export const Constants = {
  SCRIPT_TYPES: {
    P2SH: 'P2SH',
    P2PKH: 'P2PKH',
    P2WPKH: 'P2WPKH',
    P2WSH: 'P2WSH'
  },
  // not used, since Credentials 2.0
  DERIVATION_STRATEGIES: {
    BIP44: 'BIP44',
    BIP45: 'BIP45',
    BIP48: 'BIP48'
  },
  PATHS: {
    SINGLE_ADDRESS: 'm/0/0',
    REQUEST_KEY: "m/1'/0",
    //  TXPROPOSAL_KEY: "m/1'/1",
    REQUEST_KEY_AUTH: 'm/2' // relative to BASE
  },
  BIP45_SHARED_INDEX: 0x80000000 - 1,
  BITPAY_SUPPORTED_COINS: [
    'btc',
    'bch',
    'eth',
    'rsk',
    'xrp',
    'doge',
    'ltc',
    'usdc',
    'usdp',
    'pax', // backwards compatibility
    'gusd',
    'busd',
    'dai',
    'wbtc',
    'shib',
    'ape',
    'euroc'
  ],
  BITPAY_SUPPORTED_ERC20: [
    'usdc',
    'usdp',
    'pax', // backwards compatibility
    'gusd',
    'busd',
    'xusd', // Sovryn token
    'dai',
    'wbtc',
    'shib',
    'ape',
    'euroc'
  ],
  UTXO_COINS: ['btc', 'bch', 'doge', 'ltc'],
  CHAINS: ['btc', 'bch', 'eth', 'xrp', 'doge', 'ltc', 'rsk'],
  UTXO_CHAINS: ['btc', 'bch', 'doge', 'ltc'],
  EVM_CHAINS: ['eth', 'rsk'],
  TOKEN_OPTS: CWC.Constants.TOKEN_OPTS,
  UNITS: CWC.Constants.UNITS
};
