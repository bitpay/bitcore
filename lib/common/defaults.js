'use strict';

var Defaults = {};

Defaults.DEFAULT_FEE_PER_KB = 10000;
Defaults.MIN_FEE_PER_KB = 0;
Defaults.MAX_FEE_PER_KB = 1000000;
Defaults.MAX_TX_FEE = 1 * 1e8;

Defaults.MAX_KEYS = 100;

// Time after which a Tx proposal can be erased by any copayer. in seconds
Defaults.DELETE_LOCKTIME = 24 * 3600;

// Allowed consecutive txp rejections before backoff is applied.
Defaults.BACKOFF_OFFSET = 3;

// Time a copayer need to wait to create a new TX after her tx previous proposal we rejected. (incremental). in Minutes.
Defaults.BACKOFF_TIME = 2;

Defaults.MAX_MAIN_ADDRESS_GAP = 20;

// TODO: should allow different gap sizes for external/internal chains
Defaults.SCAN_ADDRESS_GAP = Defaults.MAX_MAIN_ADDRESS_GAP;

Defaults.FEE_LEVELS = [{
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

// Minimum nb of addresses a wallet must have to start using 2-step balance optimization
Defaults.TWO_STEP_BALANCE_THRESHOLD = 100;

Defaults.FIAT_RATE_PROVIDER = 'BitPay';
Defaults.FIAT_RATE_FETCH_INTERVAL = 10; // In minutes


module.exports = Defaults;
