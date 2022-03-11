'use strict';
import * as CWC from 'crypto-wallet-core';

module.exports = {
  CHAINS: {
    BTC: 'btc',
    BCH: 'bch',
    ETH: 'eth',
    XRP: 'xrp',
    DOGE: 'doge',
    LTC: 'ltc'
  },

  // TODO rethink COINS. If we want to concatenate CHAINS + ERC20's, we can do that in the implementation.
  // In the future, ERC20 "coins" may not be specific to ETH, so inferring that a USDC coin is on ETH (for example) may be incorrect.
  // Perhaps, this should be a nested object, with there being coins nested inside smart chains.
  COINS: {
    BTC: 'btc',
    BCH: 'bch',
    ETH: 'eth',
    XRP: 'xrp',
    DOGE: 'doge',
    LTC: 'ltc',
    USDC: 'usdc',
    PAX: 'pax',
    GUSD: 'gusd',
    BUSD: 'busd',
    DAI: 'dai',
    WBTC: 'wbtc',
    SHIB: 'shib'
  },

  ERC20: {
    USDC: 'usdc',
    PAX: 'pax',
    GUSD: 'gusd',
    BUSD: 'busd',
    DAI: 'dai',
    WBTC: 'wbtc',
    SHIB: 'shib'
  },

  USD_STABLECOINS: {
    USDC: 'usdc',
    PAX: 'pax',
    GUSD: 'gusd',
    BUSD: 'busd',
    DAI: 'dai'
  },

  UTXO_COINS: {
    BTC: 'btc',
    BCH: 'bch',
    DOGE: 'doge',
    LTC: 'ltc'
  },

  NETWORKS: {
    LIVENET: 'livenet',
    TESTNET: 'testnet'
  },

  ADDRESS_FORMATS: ['copay', 'cashaddr', 'legacy'],

  SCRIPT_TYPES: {
    P2SH: 'P2SH',
    P2WSH: 'P2WSH',
    P2PKH: 'P2PKH',
    P2WPKH: 'P2WPKH'
  },
  DERIVATION_STRATEGIES: {
    BIP44: 'BIP44',
    BIP45: 'BIP45'
  },

  PATHS: {
    SINGLE_ADDRESS: "m/0'/0",
    REQUEST_KEY: "m/1'/0",
    TXPROPOSAL_KEY: "m/1'/1",
    REQUEST_KEY_AUTH: 'm/2' // relative to BASE
  },

  BIP45_SHARED_INDEX: 0x80000000 - 1,

  TOKEN_OPTS: CWC.Constants.TOKEN_OPTS
};
