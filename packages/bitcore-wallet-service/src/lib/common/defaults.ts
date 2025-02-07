'use strict';

export const Defaults = {
  MIN_FEE_PER_KB: 0,

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
        multiplier: 1.05, // To fix fees < 1sat/byte
        defaultValue: 2000
      }
    ],
    xec: [
      {
        name: 'normal',
        nbBlocks: 2,
        defaultValue: 1000
      }
    ],
    xpi: [
      {
        name: 'normal',
        nbBlocks: 2,
        defaultValue: 10000
      }
    ],
    eth: [
      {
        name: 'urgent',
        nbBlocks: 1,
        defaultValue: 10000000000
      },
      {
        name: 'priority',
        nbBlocks: 2,
        defaultValue: 5000000000
      },
      {
        name: 'normal',
        nbBlocks: 3,
        defaultValue: 1000000000
      },
      {
        name: 'economy',
        nbBlocks: 4,
        defaultValue: 1000000000
      },
      {
        name: 'superEconomy',
        nbBlocks: 4,
        defaultValue: 1000000000
      }
    ],
    matic: [
      {
        name: 'urgent',
        nbBlocks: 1,
        defaultValue: 300000000000
      },
      {
        name: 'priority',
        nbBlocks: 2,
        defaultValue: 250000000000
      },
      {
        name: 'normal',
        nbBlocks: 3,
        defaultValue: 200000000000
      },
      {
        name: 'economy',
        nbBlocks: 4,
        defaultValue: 200000000000
      },
      {
        name: 'superEconomy',
        nbBlocks: 4,
        defaultValue: 200000000000
      }
    ],
    arb: [
      {
        name: 'urgent',
        nbBlocks: 1,
        defaultValue: 3000000000
      },
      {
        name: 'priority',
        nbBlocks: 2,
        defaultValue: 2500000000
      },
      {
        name: 'normal',
        nbBlocks: 3,
        defaultValue: 2000000000
      },
      {
        name: 'economy',
        nbBlocks: 4,
        defaultValue: 2000000000
      },
      {
        name: 'superEconomy',
        nbBlocks: 4,
        defaultValue: 2000000000
      }
    ],
    base: [
      {
        name: 'urgent',
        nbBlocks: 1,
        defaultValue: 3000000000
      },
      {
        name: 'priority',
        nbBlocks: 2,
        defaultValue: 2500000000
      },
      {
        name: 'normal',
        nbBlocks: 3,
        defaultValue: 2000000000
      },
      {
        name: 'economy',
        nbBlocks: 4,
        defaultValue: 2000000000
      },
      {
        name: 'superEconomy',
        nbBlocks: 4,
        defaultValue: 2000000000
      }
    ],
    op: [
      {
        name: 'urgent',
        nbBlocks: 1,
        defaultValue: 3000000000
      },
      {
        name: 'priority',
        nbBlocks: 2,
        defaultValue: 2500000000
      },
      {
        name: 'normal',
        nbBlocks: 3,
        defaultValue: 2000000000
      },
      {
        name: 'economy',
        nbBlocks: 4,
        defaultValue: 2000000000
      },
      {
        name: 'superEconomy',
        nbBlocks: 4,
        defaultValue: 2000000000
      }
    ],
    xrp: [
      {
        name: 'normal',
        nbBlocks: 1, // 3 seconds
        defaultValue: 12
      }
    ],
    doge: [
      {
        name: 'normal',
        nbBlocks: 2,
        defaultValue: 100000000
      }
    ],
    ltc: [
      {
        name: 'urgent',
        nbBlocks: 2,
        defaultValue: 150000
      },
      {
        name: 'priority',
        nbBlocks: 2,
        defaultValue: 100000
      },
      {
        name: 'normal',
        nbBlocks: 3,
        defaultValue: 100000
      },
      {
        name: 'economy',
        nbBlocks: 6,
        defaultValue: 10000
      },
      {
        name: 'superEconomy',
        nbBlocks: 24,
        defaultValue: 10000
      }
    ]
  },

  // How many levels to fallback to if the value returned by the network for a given nbBlocks is -1
  FEE_LEVELS_FALLBACK: 2,

  FIAT_RATE_PROVIDER: 'CryptoCompare',
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
  MIN_OUTPUT_AMOUNT: 546,

  // Number of confirmations from which tx in history will be cached
  // (ie we consider them inmutables)
  CONFIRMATIONS_TO_START_CACHING: 6 * 6, // ~ 6hrs

  // Coinbase transaction outputs can only be spent after this number of new
  // blocks (network rule).
  COINBASE_MATURITY: 100,

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

  // Cache time for latest copay version (in ms)
  COPAY_VERSION_CACHE_DURATION: 6 * 60 * 1000,

  // Oneinch token list cache duration (in ms)
  ONE_INCH_CACHE_DURATION: 1 * 60 * 1000,

  // Coingecko token rates cache duration (in ms)
  COIN_GECKO_CACHE_DURATION: 5 * 60 * 1000,

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
      message: 'Too many wallets created from this IP, please try again after an hour'
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
  EVM_COIN: 'eth',
  CHAIN: 'btc',
  EVM_CHAIN: 'eth',
  INSIGHT_REQUEST_POOL_SIZE: 10,
  INSIGHT_TIMEOUT: 30000,

  ADDRESS_SYNC_BATCH_SIZE: 500000,

  LOCK_WAIT_TIME: 5 * 1000, // wait time 5s
  LOCK_EXE_TIME: 40 * 1000, // max lock time 50s
  SERVER_EXE_TIME: 40 * 1000 * 1.5,

  BE_KEY_SALT: 'bws-auth-keysalt',

  BROADCAST_RETRY_TIME: 350, // ms

  /*
   *      COIN SPECIFIC
   */

  MAX_TX_SIZE_IN_KB_BTC: 100,

  MAX_TX_SIZE_IN_KB_BCH: 100,

  MAX_TX_SIZE_IN_KB_DOGE: 100,

  // MAX_TX_SIZE_IN_KB_ETH: 500, // not used
  // MAX_TX_SIZE_IN_KB_XRP: 1000, // not used

  MAX_FEE_PER_KB: {
    btc: 10000 * 1000, // 10k sat/b
    bch: 10000 * 1000, // 10k sat/b
    eth: 1000000000000, // 50 Gwei,
    matic: 1000000000000, // 50 Gwei,
    arb: 1000000000000, // 50 Gwei,
    base: 1000000000000, // 50 Gwei,
    op: 1000000000000, // 50 Gwei,
    xrp: 1000000000000,
    xpi: 1000000000000,
    doge: 100000000 * 100,
    xec: 100 * 100,
    ltc: 10000 * 1000 // 10k sat/b
  },

  MIN_TX_FEE: {
    btc: 0,
    bch: 0,
    eth: 0,
    matic: 0,
    arb: 0,
    base: 0,
    op: 0,
    xrp: 0,
    doge: 0,
    xpi: 0,
    xec: 0,
    ltc: 0
  },

  MAX_TX_FEE: {
    btc: 0.05 * 1e8,
    bch: 0.05 * 1e8,
    eth: 1 * 1e18, // 1 eth
    matic: 1 * 1e18, // 1 matic
    arb: 1 * 1e18, // 1 eth
    base: 1 * 1e18, // 1 eth
    op: 1 * 1e18, // 1 eth
    xrp: 1 * 1e6, // 1 xrp
    doge: 400 * 1e8,
    xpi: 1 * 1e6, // 1 xpi
    xec: 400 * 1e2, // 1 xpi
    ltc: 0.05 * 1e8
  },

  // ETH
  DEFAULT_GAS_LIMIT: 60000,
  DEFAULT_ERC20_GAS_LIMIT: 160000,
  // Gas Limit per each multisend recipient
  DEFAULT_MULTISEND_RECIPIENT_GAS_LIMIT: 45000,
  DEFAULT_MULTISEND_RECIPIENT_ERC20_GAS_LIMIT: 65000,
  MIN_GAS_LIMIT: 21000,

  // Added buffer to account for variance between estimateGas and live execution
  MS_GAS_LIMIT_BUFFER_PERCENT: 10 / 100,

  // XRP has a non-refundable mininum activation fee / balance
  MIN_XRP_BALANCE: 10000000,

  // Time to get the latest push notification subscriptions. In ms.
  PUSH_NOTIFICATION_SUBS_TIME: 10 * 60 * 1000, // 10 min.

  PUSH_NOTIFICATION_LIMIT: 10,

  FIAT_CURRENCIES: [
    { code: 'USD', name: 'US Dollar' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'GBP', name: 'Pound Sterling' },
    { code: 'EUR', name: 'Eurozone Euro' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'COP', name: 'Colombian Peso' },
    { code: 'NGN', name: 'Nigerian Naira' },
    { code: 'BRL', name: 'Brazilian Real' },
    { code: 'ARS', name: 'Argentine Peso' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'NZD', name: 'New Zealand Dollar' },
    { code: 'HNL', name: 'Honduran Lempira' }
  ],

  SUPPORT_FIAT_CURRENCIES: [
    { code: 'AED', name: 'United Arab Emirates Dirham' },
    { code: 'AFN', name: 'Afghan Afghani' },
    { code: 'ALL', name: 'Albanian Lek' },
    { code: 'AMD', name: 'Armenian Dram' },
    { code: 'ANG', name: 'Netherlands Antillean Guilder' },
    { code: 'AOA', name: 'Angolan Kwanza' },
    { code: 'ARS', name: 'Argentine Peso' },
    { code: 'AUD', name: 'Australian Dollar' },
    { code: 'AWG', name: 'Aruban Florin' },
    { code: 'AZN', name: 'Azerbaijani Manat' },
    { code: 'BAM', name: 'Bosnia-Herzegovina Convertible Mark' },
    { code: 'BBD', name: 'Barbadian Dollar' },
    { code: 'BDT', name: 'Bangladeshi Taka' },
    { code: 'BGN', name: 'Bulgarian Lev' },
    { code: 'BHD', name: 'Bahraini Dinar' },
    { code: 'BIF', name: 'Burundian Franc' },
    { code: 'BMD', name: 'Bermudian Dollar' },
    { code: 'BND', name: 'Brunei Dollar' },
    { code: 'BOB', name: 'Bolivian Boliviano' },
    { code: 'BRL', name: 'Brazilian Real' },
    { code: 'BSD', name: 'Bahamian Dollar' },
    { code: 'BTN', name: 'Bhutanese Ngultrum' },
    { code: 'BWP', name: 'Botswana Pula' },
    { code: 'BYN', name: 'Belarusian Ruble' },
    { code: 'BYR', name: 'Belarusian Ruble (Old)' },
    { code: 'BZD', name: 'Belize Dollar' },
    { code: 'CAD', name: 'Canadian Dollar' },
    { code: 'CDF', name: 'Congolese Franc' },
    { code: 'CHF', name: 'Swiss Franc' },
    { code: 'CLF', name: 'Chilean Unit of Account (UF)' },
    { code: 'CLP', name: 'Chilean Peso' },
    { code: 'CNY', name: 'Chinese Yuan' },
    { code: 'COP', name: 'Colombian Peso' },
    { code: 'CRC', name: 'Costa Rican Colón' },
    { code: 'CUC', name: 'Cuban Convertible Peso' },
    { code: 'CUP', name: 'Cuban Peso' },
    { code: 'CVE', name: 'Cape Verdean Escudo' },
    { code: 'CZK', name: 'Czech Koruna' },
    { code: 'DJF', name: 'Djiboutian Franc' },
    { code: 'DKK', name: 'Danish Krone' },
    { code: 'DOP', name: 'Dominican Peso' },
    { code: 'DZD', name: 'Algerian Dinar' },
    { code: 'EGP', name: 'Egyptian Pound' },
    { code: 'ERN', name: 'Eritrean Nakfa' },
    { code: 'ETB', name: 'Ethiopian Birr' },
    { code: 'EUR', name: 'Euro' },
    { code: 'FJD', name: 'Fijian Dollar' },
    { code: 'FKP', name: 'Falkland Islands Pound' },
    { code: 'GBP', name: 'British Pound Sterling' },
    { code: 'GEL', name: 'Georgian Lari' },
    { code: 'GGP', name: 'Guernsey Pound' },
    { code: 'GHS', name: 'Ghanaian Cedi' },
    { code: 'GIP', name: 'Gibraltar Pound' },
    { code: 'GMD', name: 'Gambian Dalasi' },
    { code: 'GNF', name: 'Guinean Franc' },
    { code: 'GTQ', name: 'Guatemalan Quetzal' },
    { code: 'GYD', name: 'Guyanaese Dollar' },
    { code: 'HKD', name: 'Hong Kong Dollar' },
    { code: 'HNL', name: 'Honduran Lempira' },
    { code: 'HRK', name: 'Croatian Kuna' },
    { code: 'HTG', name: 'Haitian Gourde' },
    { code: 'HUF', name: 'Hungarian Forint' },
    { code: 'IDR', name: 'Indonesian Rupiah' },
    { code: 'ILS', name: 'Israeli New Shekel' },
    { code: 'IMP', name: 'Isle of Man Pound' },
    { code: 'INR', name: 'Indian Rupee' },
    { code: 'IQD', name: 'Iraqi Dinar' },
    { code: 'IRR', name: 'Iranian Rial' },
    { code: 'ISK', name: 'Icelandic Króna' },
    { code: 'JEP', name: 'Jersey Pound' },
    { code: 'JMD', name: 'Jamaican Dollar' },
    { code: 'JOD', name: 'Jordanian Dinar' },
    { code: 'JPY', name: 'Japanese Yen' },
    { code: 'KES', name: 'Kenyan Shilling' },
    { code: 'KGS', name: 'Kyrgyzstani Som' },
    { code: 'KHR', name: 'Cambodian Riel' },
    { code: 'KMF', name: 'Comorian Franc' },
    { code: 'KPW', name: 'North Korean Won' },
    { code: 'KRW', name: 'South Korean Won' },
    { code: 'KWD', name: 'Kuwaiti Dinar' },
    { code: 'KYD', name: 'Cayman Islands Dollar' },
    { code: 'KZT', name: 'Kazakhstani Tenge' },
    { code: 'LAK', name: 'Lao Kip' },
    { code: 'LBP', name: 'Lebanese Pound' },
    { code: 'LKR', name: 'Sri Lankan Rupee' },
    { code: 'LRD', name: 'Liberian Dollar' },
    { code: 'LSL', name: 'Lesotho Loti' },
    { code: 'LTL', name: 'Lithuanian Litas' },
    { code: 'LVL', name: 'Latvian Lats' },
    { code: 'LYD', name: 'Libyan Dinar' },
    { code: 'MAD', name: 'Moroccan Dirham' },
    { code: 'MDL', name: 'Moldovan Leu' },
    { code: 'MGA', name: 'Malagasy Ariary' },
    { code: 'MKD', name: 'Macedonian Denar' },
    { code: 'MMK', name: 'Myanmar Kyat' },
    { code: 'MNT', name: 'Mongolian Tugrik' },
    { code: 'MOP', name: 'Macanese Pataca' },
    { code: 'MRO', name: 'Mauritanian Ouguiya (pre-2018)' },
    { code: 'MRU', name: 'Mauritanian Ouguiya' },
    { code: 'MUR', name: 'Mauritian Rupee' },
    { code: 'MVR', name: 'Maldivian Rufiyaa' },
    { code: 'MWK', name: 'Malawian Kwacha' },
    { code: 'MXN', name: 'Mexican Peso' },
    { code: 'MYR', name: 'Malaysian Ringgit' },
    { code: 'MZN', name: 'Mozambican Metical' },
    { code: 'NAD', name: 'Namibian Dollar' },
    { code: 'NGN', name: 'Nigerian Naira' },
    { code: 'NIO', name: 'Nicaraguan Córdoba' },
    { code: 'NOK', name: 'Norwegian Krone' },
    { code: 'NPR', name: 'Nepalese Rupee' },
    { code: 'NZD', name: 'New Zealand Dollar' },
    { code: 'OMR', name: 'Omani Rial' },
    { code: 'PAB', name: 'Panamanian Balboa' },
    { code: 'PEN', name: 'Peruvian Sol' },
    { code: 'PGK', name: 'Papua New Guinean Kina' },
    { code: 'PHP', name: 'Philippine Peso' },
    { code: 'PKR', name: 'Pakistani Rupee' },
    { code: 'PLN', name: 'Polish Złoty' },
    { code: 'PYG', name: 'Paraguayan Guarani' },
    { code: 'QAR', name: 'Qatari Riyal' },
    { code: 'RON', name: 'Romanian Leu' },
    { code: 'RSD', name: 'Serbian Dinar' },
    { code: 'RUB', name: 'Russian Ruble' },
    { code: 'RWF', name: 'Rwandan Franc' },
    { code: 'SAR', name: 'Saudi Riyal' },
    { code: 'SBD', name: 'Solomon Islands Dollar' },
    { code: 'SCR', name: 'Seychellois Rupee' },
    { code: 'SDG', name: 'Sudanese Pound' },
    { code: 'SEK', name: 'Swedish Krona' },
    { code: 'SGD', name: 'Singapore Dollar' },
    { code: 'SHP', name: 'Saint Helena Pound' },
    { code: 'SLE', name: 'Sierra Leonean Leone' },
    { code: 'SLL', name: 'Sierra Leone Leone' },
    { code: 'SOS', name: 'Somali Shilling' },
    { code: 'SRD', name: 'Surinamese Dollar' },
    { code: 'STD', name: 'São Tomé and Príncipe Dobra' },
    { code: 'STN', name: 'São Tomé and Príncipe New Dobra' },
    { code: 'SVC', name: 'Salvadoran Colón' },
    { code: 'SYP', name: 'Syrian Pound' },
    { code: 'SZL', name: 'Swazi Lilangeni' },
    { code: 'THB', name: 'Thai Baht' },
    { code: 'TJS', name: 'Tajikistani Somoni' },
    { code: 'TMT', name: 'Turkmenistani Manat' },
    { code: 'TND', name: 'Tunisian Dinar' },
    { code: 'TOP', name: 'Tongan Paʻanga' },
    { code: 'TRY', name: 'Turkish Lira' },
    { code: 'TTD', name: 'Trinidad and Tobago Dollar' },
    { code: 'TWD', name: 'New Taiwan Dollar' },
    { code: 'TZS', name: 'Tanzanian Shilling' },
    { code: 'UAH', name: 'Ukrainian Hryvnia' },
    { code: 'UGX', name: 'Ugandan Shilling' },
    { code: 'USD', name: 'United States Dollar' },
    { code: 'UYU', name: 'Uruguayan Peso' },
    { code: 'UZS', name: 'Uzbekistani Som' },
    { code: 'VEF', name: 'Venezuelan Bolívar' },
    { code: 'VES', name: 'Venezuelan Bolívar Soberano' },
    { code: 'VND', name: 'Vietnamese Dong' },
    { code: 'VUV', name: 'Vanuatu Vatu' },
    { code: 'WST', name: 'Samoan Tala' },
    { code: 'XAF', name: 'CFA Franc (Central Africa)' },
    { code: 'XAG', name: 'Silver Ounce' },
    { code: 'XAU', name: 'Gold Ounce' },
    { code: 'XCD', name: 'East Caribbean Dollar' },
    { code: 'XDR', name: 'Special Drawing Rights' },
    { code: 'XOF', name: 'CFA Franc (West Africa)' },
    { code: 'XPD', name: 'Palladium Ounce' },
    { code: 'XPF', name: 'CFP Franc' },
    { code: 'XPT', name: 'Platinum Ounce' },
    { code: 'YER', name: 'Yemeni Rial' },
    { code: 'ZAR', name: 'South African Rand' },
    { code: 'ZMK', name: 'Zambian Kwacha' },
    { code: 'ZMW', name: 'Zambian Kwacha' },
    { code: 'ZWG', name: 'Zimbabwe Gold Bond' },
    { code: 'ZWL', name: 'Zimbabwean Dollar' }
  ],
  FIAT_CURRENCY: { code: 'USD', name: 'US Dollar' }
};
