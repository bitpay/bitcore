'use strict';
import * as CWC from 'crypto-wallet-core';

module.exports = {
  CHAINS: {
    BTC: 'btc',
    BCH: 'bch',
    ETH: 'eth',
    MATIC: 'matic',
    XRP: 'xrp',
    DOGE: 'doge',
    LTC: 'ltc'
  },

  // TODO rethink COINS. If we want to concatenate CHAINS + ERC20's, we can do that in the implementation.
  // In the future, ERC20 "coins" may not be specific to ETH, so inferring that a USDC coin is on ETH (for example) may be incorrect.
  // Perhaps, this should be a nested object, with there being coins nested inside smart chains.
  BITPAY_SUPPORTED_COINS: {
    BTC: 'btc',
    BCH: 'bch',
    ETH: 'eth',
    MATIC: 'matic',
    XRP: 'xrp',
    DOGE: 'doge',
    LTC: 'ltc',
    MATIC_E: 'matic_e',
    USDC_E: 'usdc_e',
    USDP_E: 'usdp_e',
    PAX_E: 'pax_e',
    GUSD_E: 'gusd_e',
    BUSD_E: 'busd_e',
    DAI_E: 'dai_e',
    WBTC_E: 'wbtc_e',
    SHIB_E: 'shib_e',
    APE_E: 'ape_e',
    EUROC_E: 'euroc_e',
    ETH_M: 'eth_m',
    USDC_M: 'usdc_m',
    USDP_M: 'usdp_m',
    PAX_M: 'pax_m',
    GUSD_M: 'gusd_m',
    BUSD_M: 'busd_m',
    DAI_M: 'dai_m',
    WBTC_M: 'wbtc_m',
    SHIB_M: 'shib_m',
    APE_M: 'ape_m',
    EUROC_M: 'euroc_m'
  },

  BITPAY_SUPPORTED_ETH_ERC20: {
    MATIC_E: 'matic_e',
    USDC_E: 'usdc_e',
    USDP_E: 'usdp_e',
    PAX_E: 'pax_e', // backwards compatability
    GUSD_E: 'gusd_e',
    BUSD_E: 'busd_e',
    DAI_E: 'dai_e',
    WBTC_E: 'wbtc_e',
    SHIB_E: 'shib_e',
    APE_E: 'ape_e',
    EUROC_E: 'euroc_e'
  },

  BITPAY_SUPPORTED_MATIC_ERC20: {
    ETH_M: 'eth_m',
    USDC_M: 'usdc_m',
    USDP_M: 'usdp_m',
    PAX_M: 'pax_m',
    GUSD_M: 'gusd_m',
    BUSD_M: 'busd_m',
    DAI_M: 'dai_m',
    WBTC_M: 'wbtc_m',
    SHIB_M: 'shib_m',
    APE_M: 'ape_m',
    EUROC_M: 'euroc_m'
  },

  BITPAY_USD_STABLECOINS: {
    USDC_E: 'usdc_e',
    USDP_E: 'usdp_e',
    PAX_E: 'pax_e',
    GUSD_E: 'gusd_e',
    BUSD_E: 'busd_e',
    DAI_E: 'dai_e',
    USDC_M: 'usdc_m',
    USDP_M: 'usdp_m',
    PAX_M: 'pax_m',
    GUSD_M: 'gusd_m',
    BUSD_M: 'busd_m',
    DAI_M: 'dai_m'
  },

  BITPAY_EUR_STABLECOINS: {
    EUROC_E: 'euroc_e',
    EUROC_M: 'euroc_m'
  },

  UTXO_CHAINS: {
    BTC: 'btc',
    BCH: 'bch',
    DOGE: 'doge',
    LTC: 'ltc'
  },

  EVM_CHAINS: {
    ETH: 'eth',
    MATIC: 'matic'
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

  ETH_TOKEN_OPTS: CWC.Constants.ETH_TOKEN_OPTS,
  MATIC_TOKEN_OPTS: CWC.Constants.MATIC_TOKEN_OPTS
};
