'use strict';
import * as CWC from '@abcpros/crypto-wallet-core';

module.exports = {
  COINS: {
    BTC: 'btc',
    BCH: 'bch',
    XEC: 'xec',
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
    XPI: 'xpi'
  },

  ERC20: {
    USDC: 'usdc',
    PAX: 'pax',
    GUSD: 'gusd',
    BUSD: 'busd',
    DAI: 'dai',
    WBTC: 'wbtc'
  },

  UTXO_COINS: {
    BTC: 'btc',
    BCH: 'bch',
    XEC: 'xec',
    DOGE: 'doge',
    XPI: 'xpi',
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

  TOKEN_OPTS: CWC.Constants.TOKEN_OPTS,

  opReturn: {
    opReturnPrefixHex: '6a',
    opReturnAppPrefixLengthHex: '04',
    opPushDataOne: '4c',
    appPrefixesHex: {
      eToken: '534c5000',
      lotusChat: '02020202',
      lotusChatEncrypted: '03030303'
    },
    encryptedMsgByteLimit: 206,
    unencryptedMsgByteLimit: 215
  },

  MESSAGE_PREFIX: {
    XEC: '\x16eCash Signed Message:\n',
    XPI: '\x16Lotus Signed Message:\n'
  }
};
