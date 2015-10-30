'use strict';

var Constants = {};

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

Constants.DEFAULT_FEE_PER_KB = 10000;
Constants.MIN_FEE_PER_KB = 0;
Constants.MAX_FEE_PER_KB = 1000000;
Constants.MAX_TX_FEE = 1 * 1e8;

Constants.MAX_KEYS = 100;

// Time after which a Tx proposal can be erased by any copayer. in seconds
Constants.DELETE_LOCKTIME = 24 * 3600;

// Allowed consecutive txp rejections before backoff is applied.
Constants.BACKOFF_OFFSET = 3;

// Time a copayer need to wait to create a new TX after her tx previous proposal we rejected. (incremental). in Minutes.
Constants.BACKOFF_TIME = 2;

Constants.MAX_MAIN_ADDRESS_GAP = 20;

// Fund scanning parameters
Constants.SCAN_CONFIG = {
  maxGap: Constants.MAX_MAIN_ADDRESS_GAP,
};

Constants.FEE_LEVELS = [{
  name: 'priority',
  nbBlocks: 1,
  defaultValue: 50000
}, {
  name: 'normal',
  nbBlocks: 2,
  defaultValue: 20000
}, {
  name: 'economy',
  nbBlocks: 6,
  defaultValue: 10000
}];

module.exports = Constants;
