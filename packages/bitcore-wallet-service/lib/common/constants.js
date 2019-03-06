'use strict';

var Constants = {};

Constants.COINS = {
  BTC: 'btc',
  BCH: 'bch',
};


Constants.NETWORKS = {
  LIVENET: 'livenet',
  TESTNET: 'testnet',
};

Constants.ADDRESS_FORMATS = ['copay', 'cashaddr', 'legacy'];

Constants.SCRIPT_TYPES = {
  P2SH: 'P2SH',
  P2PKH: 'P2PKH',
};
Constants.DERIVATION_STRATEGIES = {
  BIP44: 'BIP44',
  BIP45: 'BIP45',
};

Constants.PATHS = {
  REQUEST_KEY: "m/1'/0",
  TXPROPOSAL_KEY: "m/1'/1",
  REQUEST_KEY_AUTH: "m/2", // relative to BASE
};

Constants.BIP45_SHARED_INDEX = 0x80000000 - 1;

module.exports = Constants;
