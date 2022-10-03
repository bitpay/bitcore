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

  BITPAY_SUPPORTED_ETH_ERC20: [
    'matic_e',
    'usdc_e',
    'pax_e',
    'gusd_e',
    'busd_e',
    'dai_e',
    'wbtc_e',
    'shib_e',
    'ape_e',
    'euroc_e'
  ],

  BITPAY_SUPPORTED_MATIC_ERC20: [
    'eth_m',
    'usdc_m',
    'pax_m',
    'gusd_m',
    'busd_m',
    'dai_m',
    'wbtc_m',
    'shib_m',
    'ape_m',
    'euroc_m'
  ],

  CHAINS: ['btc', 'bch', 'eth', 'matic', 'xrp', 'doge', 'ltc'],
  UTXO_CHAINS: ['btc', 'bch', 'doge', 'ltc'],
  EVM_CHAINS: ['eth', 'matic'],
  ETH_TOKEN_OPTS: CWC.Constants.ETH_TOKEN_OPTS,
  MATIC_TOKEN_OPTS: CWC.Constants.MATIC_TOKEN_OPTS,
  UNITS: CWC.Constants.UNITS
};
