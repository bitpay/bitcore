'use strict';

module.exports = {
  MIN_FEE_PER_KB: 0,
  MAX_FEE_PER_KB: 10000 * 1000, // 10k sat/b
  MIN_TX_FEE: 0,
  MAX_TX_FEE: 0.1 * 1e8,
  MAX_TX_SIZE_IN_KB: 100,

  // ETH
  DEFAULT_GAS_LIMIT: 21000,

  MAX_KEYS: 100,

  // Time after which a tx proposal can be erased by any copayer. in seconds
  DELETE_LOCKTIME: 600,

  // Allowed consecutive txp rejections before backoff is applied.
  BACKOFF_OFFSET: 10,

  // Time a copayer need to wait to create a new tx after her previous proposal was rejected. in seconds.
  BACKOFF_TIME: 600,

  MAX_MAIN_ADDRESS_GAP: 20,

  // TODO: should allow different gap sizes for external/internal chains
  SCAN_ADDRESS_GAP: 30,

  FEE_LEVELS: {
    btc: [
      {
        name: 'urgent',
        nbBlocks: 2,
        multiplier: 1.5,
        defaultValue: 75000
      },
      {
        name: 'priority',
        nbBlocks: 2,
        defaultValue: 50000
      },
      {
        name: 'normal',
        nbBlocks: 3,
        defaultValue: 30000
      },
      {
        name: 'economy',
        nbBlocks: 6,
        defaultValue: 25000
      },
      {
        name: 'superEconomy',
        nbBlocks: 24,
        defaultValue: 10000
      }
    ],
    bch: [
      {
        name: 'normal',
        nbBlocks: 2,
        defaultValue: 2000
      }
    ],
    eth: [
      {
        name: 'urgent',
        nbBlocks: 10, // < 2 min
        defaultValue: 3000000000
      },
      {
        name: 'priority',
        nbBlocks: 15, // 3 min
        defaultValue: 2000000000
      },
      {
        name: 'normal',
        nbBlocks: 25, // 5 min
        defaultValue: 1000000000
      },
      {
        name: 'economy',
        nbBlocks: 50, // 10 minutes
        defaultValue: 1000000000
      },
      {
        name: 'superEconomy',
        nbBlocks: 75, // 15 minutes
        defaultValue: 1000000000
      }
    ]
  },

  // How many levels to fallback to if the value returned by the network for a given nbBlocks is -1
  FEE_LEVELS_FALLBACK: 2,

  FIAT_RATE_PROVIDER: 'BitPay',
  FIAT_RATE_FETCH_INTERVAL: 10, // In minutes
  FIAT_RATE_MAX_LOOK_BACK_TIME: 120, // In minutes

  HISTORY_LIMIT: 1001,

  // The maximum amount of an UTXO to be considered too big to be used in the tx before exploring smaller
  // alternatives (proportinal to tx amount).
  UTXO_SELECTION_MAX_SINGLE_UTXO_FACTOR: 2,

  // The minimum amount an UTXO need to contribute proportional to tx amount.
  UTXO_SELECTION_MIN_TX_AMOUNT_VS_UTXO_FACTOR: 0.1,

  // The maximum threshold to consider fees non-significant in relation to tx amount.
  UTXO_SELECTION_MAX_FEE_VS_TX_AMOUNT_FACTOR: 0.05,

  // The maximum amount to pay for using small inputs instead of one big input
  // when fees are significant (proportional to how much we would pay for using that big input only).
  UTXO_SELECTION_MAX_FEE_VS_SINGLE_UTXO_FEE_FACTOR: 5,

  // Minimum allowed amount for tx outputs (including change) in SAT
  MIN_OUTPUT_AMOUNT: 5000,

  // Number of confirmations from which tx in history will be cached
  // (ie we consider them inmutables)
  CONFIRMATIONS_TO_START_CACHING: 6 * 6, // ~ 6hrs

  // Number of addresses from which tx history is enabled in a wallet
  HISTORY_CACHE_ADDRESS_THRESOLD: 100,

  // Number of addresses from which balance in cache for a few seconds
  BALANCE_CACHE_ADDRESS_THRESOLD: 100,

  BALANCE_CACHE_DURATION: 10,

  // Cache time for blockchain height (in ms)
  // this is actually erased on 'new block' notifications
  // so, 30m seems fine
  BLOCKHEIGHT_CACHE_TIME: 30 * 60 * 1000,

  // Cache time fee levels (in ms)
  FEE_LEVEL_CACHE_DURATION: 6 * 60 * 1000,

  // Max allowed timespan for notification queries in seconds
  MAX_NOTIFICATIONS_TIMESPAN: 60 * 60 * 24 * 14, // ~ 2 weeks
  NOTIFICATIONS_TIMESPAN: 60,

  SESSION_EXPIRATION: 1 * 60 * 60, // 1 hour to session expiration

  RateLimit: {
    createWallet: {
      windowMs: 60 * 60 * 1000, // hour window
      delayAfter: 8, // begin slowing down responses after the 3rd request
      delayMs: 3000, // slow down subsequent responses by 3 seconds per request
      max: 15, // start blocking after 20 request
      message:
        'Too many wallets created from this IP, please try again after an hour'
    },
    estimateFee: {
      windowMs: 60 * 10 * 1000, // 10 min window
      delayAfter: 5, // begin slowing down responses after the 3rd request
      delayMs: 300, // slow down subsequent responses by 3 seconds per request

      max: 10, // start blocking after 200 request
      message: 'Too many request'
    }

    // otherPosts: {
    //   windowMs: 60 * 60 * 1000, // 1 hour window
    //   max: 1200 , // 1 post every 3 sec average, max.
    // },
  },

  COIN: 'btc',
  INSIGHT_REQUEST_POOL_SIZE: 10,
  INSIGHT_TIMEOUT: 30000,

  ADDRESS_SYNC_BATCH_SIZE: 500000,

  LOCK_WAIT_TIME: 5 * 1000, // wait time 5s
  LOCK_EXE_TIME: 40 * 1000, // max lock time 50s
  SERVER_EXE_TIME: 40 * 1000 * 1.5,

  BE_KEY_SALT: 'bws-auth-keysalt',

  BROADCAST_RETRY_TIME: 350, // ms
};
