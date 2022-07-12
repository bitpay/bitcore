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
  COINS: ['btc', 'bch', 'eth', 'matic', 'xrp', 'doge', 'ltc'],

  ETH_ERC20: [
    'matic_e',
    'usdc_e',
    'pax_e',
    'gusd_e',
    'busd_e',
    'dai_e',
    'wbtc_e',
    'shib_e',
    'ape_e',
    'eurc_e'
  ],

  MATIC_ERC20: [
    'eth_m',
    'usdc_m',
    'pax_m',
    'gusd_m',
    'busd_m',
    'dai_m',
    'wbtc_m',
    'shib_m',
    'ape_m',
    'eurc_m'
  ],
  UTXO_COINS: ['btc', 'bch', 'doge', 'ltc'],
  EVM_COINS: ['eth', 'matic'],
  TOKEN_OPTS: CWC.Constants.TOKEN_OPTS,
  UNITS: CWC.Constants.UNITS
};
