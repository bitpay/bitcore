'use strict';

var Defaults = {};

Defaults.MIN_FEE_PER_KB = 0;
Defaults.MAX_FEE_PER_KB = 1000000;
Defaults.MIN_TX_FEE = 0;
Defaults.MAX_TX_FEE = 0.1 * 1e8;
Defaults.MAX_TX_SIZE_IN_KB = 100;

Defaults.MAX_KEYS = 100;

// Time after which a tx proposal can be erased by any copayer. in seconds
Defaults.DELETE_LOCKTIME = 600;

// Allowed consecutive txp rejections before backoff is applied.
Defaults.BACKOFF_OFFSET = 10;

// Time a copayer need to wait to create a new tx after her previous proposal was rejected. in seconds.
Defaults.BACKOFF_TIME = 600;

Defaults.MAX_MAIN_ADDRESS_GAP = 20;

// TODO: should allow different gap sizes for external/internal chains
Defaults.SCAN_ADDRESS_GAP = Defaults.MAX_MAIN_ADDRESS_GAP + 20;

Defaults.FEE_LEVELS = [{
  name: 'urgent',
  nbBlocks: 2,
  multiplier: 1.5,
  defaultValue: 150000,
}, {
  name: 'priority',
  nbBlocks: 2,
  defaultValue: 100000
}, {
  name: 'normal',
  nbBlocks: 3,
  defaultValue: 80000
}, {
  name: 'economy',
  nbBlocks: 6,
  defaultValue: 50000
}, {
  name: 'superEconomy',
  nbBlocks: 24,
  defaultValue: 20000
}];

Defaults.DEFAULT_FEE_PER_KB = Defaults.FEE_LEVELS[1].defaultValue;

// How many levels to fallback to if the value returned by the network for a given nbBlocks is -1
Defaults.FEE_LEVELS_FALLBACK = 2;

// Minimum nb of addresses a wallet must have to start using 2-step balance optimization
Defaults.TWO_STEP_BALANCE_THRESHOLD = 100;

Defaults.FIAT_RATE_PROVIDER = 'BitPay';
Defaults.FIAT_RATE_FETCH_INTERVAL = 10; // In minutes
Defaults.FIAT_RATE_MAX_LOOK_BACK_TIME = 120; // In minutes

Defaults.HISTORY_LIMIT = 50;

// The maximum amount of an UTXO to be considered too big to be used in the tx before exploring smaller
// alternatives (proportinal to tx amount).
Defaults.UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR = 2;

// The minimum amount an UTXO need to contribute proportional to tx amount.
Defaults.UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR = 0.1;

// The maximum threshold to consider fees non-significant in relation to tx amount.
Defaults.UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR = 0.05;

// The maximum amount to pay for using small inputs instead of one big input
// when fees are significant (proportional to how much we would pay for using that big input only).
Defaults.UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR = 5;

// Minimum allowed amount for tx outputs (including change) in SAT
Defaults.MIN_OUTPUT_AMOUNT = 5000;

// Number of confirmations from which tx in history will be cached 
// (ie we consider them inmutables)
Defaults.CONFIRMATIONS_TO_START_CACHING = 6 * 6; // ~ 6hrs

// Number of addresses from which tx history is enabled in a wallet
Defaults.HISTORY_CACHE_ADDRESS_THRESOLD = 100;

// Cache time for blockchain height (in seconds)
Defaults.BLOCKHEIGHT_CACHE_TIME = 10 * 60;


// Max allowed timespan for notification queries in seconds
Defaults.MAX_NOTIFICATIONS_TIMESPAN = 60 * 60 * 24 * 14; // ~ 2 weeks
Defaults.NOTIFICATIONS_TIMESPAN = 60;

Defaults.SESSION_EXPIRATION = 1 * 60 * 60; // 1 hour to session expiration

Defaults.RateLimit = {
  createWallet: {
    windowMs: 60 * 60 * 1000, // hour window 
    delayAfter: 10, // begin slowing down responses after the 3rd request 
    delayMs: 3000, // slow down subsequent responses by 3 seconds per request 
    max: 20, // start blocking after 20 request
    message: "Too many wallets created from this IP, please try again after an hour"
  },
  // otherPosts: {
  //   windowMs: 60 * 60 * 1000, // 1 hour window 
  //   max: 1200 , // 1 post every 3 sec average, max.
  // },
};

module.exports = Defaults;
