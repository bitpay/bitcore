'use strict';

module.exports = {
  COINS: {
    BTC: 'btc',
    BCH: 'bch',
    ETH: 'eth',
    XRP: 'xrp',
    USDC: 'usdc',
    PAX: 'pax',
    GUSD: 'gusd'
  },

  ERC20: {
    USDC: 'usdc',
    PAX: 'pax',
    GUSD: 'gusd'
  },

  UTXO_COINS: {
    BTC: 'btc',
    BCH: 'bch'
  },

  NETWORKS: {
    LIVENET: 'livenet',
    TESTNET: 'testnet'
  },

  ADDRESS_FORMATS: ['copay', 'cashaddr', 'legacy'],

  SCRIPT_TYPES: {
    P2SH: 'P2SH',
    P2PKH: 'P2PKH'
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

  TOKEN_OPTS: {
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': {
      name: 'USD Coin',
      symbol: 'USDC',
      decimal: 6,
      address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48'
    },
    '0x8e870d67f660d95d5be530380d0ec0bd388289e1': {
      name: 'Paxos Standard',
      symbol: 'PAX',
      decimal: 18,
      address: '0x8e870d67f660d95d5be530380d0ec0bd388289e1'
    },
    '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd': {
      name: 'Gemini Dollar',
      symbol: 'GUSD',
      decimal: 2,
      address: '0x056fd409e1d7a124bd7017459dfea2f387b6d5cd'
    },
  },
};
