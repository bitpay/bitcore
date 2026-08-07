
const UNITS2 = {
  'btc': 100000000,
  'bit': 100,
  'sat': 1,
} as const;

const COIN = {
  btc: {
    name: 'btc',
    toSatoshis: 100000000,
    maxDecimals: 8,
    minDecimals: 8,
  },
  bit: {
    name: 'bit',
    toSatoshis: 100,
    maxDecimals: 2,
    minDecimals: 2,
  },
  bch: {
    name: 'bch',
    toSatoshis: 100000000,
    maxDecimals: 8,
    minDecimals: 8,
  },
  doge: {
    name: 'doge',
    toSatoshis: 1e8,
    maxDecimals: 8,
    minDecimals: 8
  },
  eth: {
    name: 'eth',
    toSatoshis: 1e18,
    maxDecimals: 8,
    minDecimals: 8,
  },

  USDC: {
    name: 'USD Coin',
    toSatoshis: 1e6,
    maxDecimals: 2,
    minDecimals: 2,
  },
  PAX: {
    name: 'Paxos Standard',
    toSatoshis: 1e18,
    minDecimals: 2,
    maxDecimals: 2,
  },
  GUSD: {
    name: 'Gemini Dollar',
    toSatoshis: 1e2,
    minDecimals: 2,
    maxDecimals: 2,
  },
  DAI: {
    name: 'Dai',
    toSatoshis: 1e18,
    minDecimals: 2,
    maxDecimals: 2
  },
  WBTC: {
    name: 'Wrapped Bitcoin',
    toSatoshis: 1e18,
    minDecimals: 8,
    maxDecimals: 8
  },
  SHIB: {
    name: 'Shiba Inu',
    toSatoshis: 1e18,
    minDecimals: 10,
    maxDecimals: 10,
  },
  EUROC: {
    name: 'Euro Coin',
    toSatoshis: 1e6,
    minDecimals: 2,
    maxDecimals: 2,
  },
  USDT: {
    name: 'Tether',
    toSatoshis: 1e6,
    minDecimals: 2,
    maxDecimals: 2,
  },
} as const;

const PUBLIC_API = {
  eth: {
    mainnet: 'https://ethereum-rpc.publicnode.com',
    testnet: 'https://ethereum-sepolia-rpc.publicnode.com',
  },
  matic: {
    mainnet: 'https://polygon-bor-rpc.publicnode.com',
    testnet: 'https://polygon-amoy-bor-rpc.publicnode.com',
  },
  arb: {
    mainnet: 'https://arbitrum-one.publicnode.com',
    testnet: 'https://public.stackup.sh/api/v1/node/arbitrum-sepolia',
  },
  op: {
    mainnet: 'https://optimism-rpc.publicnode.com',
    testnet: 'https://optimism-sepolia-rpc.publicnode.com',
  },
  base: {
    mainnet: 'https:/base-rpc.publicnode.com',
    testnet: 'https://base-sepolia-rpc.publicnode.com',
  }
} as const;


/**
 * The pattern for coloring terminal text in RGB format (replace R, G, B):
 * Foreground RGB: \x1b[38;2;R;G;Bm ... \x1b[39m (reset to default foreground color)
 * Background RGB: \x1b[48;2;R;G;Bm ... \x1b[49m (reset to default background color)
 * 
 * Alternatively, there are ANSI color codes for standard colors. e.g. 33 for yellow, 31 for red, etc.
 */

const COLOR = {
  green: '\x1b[32m%s\x1b[39m',
  red: '\x1b[31m%s\x1b[39m',
  yellow: '\x1b[33m%s\x1b[39m',
  blue: '\x1b[34m%s\x1b[39m',
  orange: '\x1b[38;5;208m%s\x1b[39m',
  gold: '\x1b[38;5;214m%s\x1b[39m',
  tan: '\x1b[38;5;180m%s\x1b[39m',
  beige: '\x1b[38;5;223m%s\x1b[39m',
  purple: '\x1b[38;5;129m%s\x1b[39m',
  lightgray: '\x1b[38;5;250m%s\x1b[39m',
  darkgray: '\x1b[38;5;236m%s\x1b[39m',
  pink: '\x1b[38;5;213m%s\x1b[39m',
  none: '\x1b[0m%s',
} as const;

const CHAIN_COLOR = {
  btc: COLOR.orange,
  bch: COLOR.green,
  // For Dogecoin, using a light beige color to evoke the color scheme of the Dogecoin logo
  doge: COLOR.beige,
  // For LTC, medium gray background with bold black text to evoke the silver color of Litecoin
  ltc: '\x1b[48;2;169;169;169m\x1b[1m\x1b[38;2;0;0;0m%s\x1b[39m\x1b[22m\x1b[49m',
  // For Ethereum, using a blue color that is commonly associated with the Ethereum logo
  eth: '\x1b[38;2;97;125;234m%s\x1b[39m',
  // For Polygon, using a pink color that is commonly associated with the Polygon logo
  matic: COLOR.pink,
  // For XRP, use black background with light gray text to evoke the color scheme of the XRP logo
  xrp: '\x1b[48;2;0;0;0m\x1b[38;5;250m%s\x1b[39m\x1b[49m',
  // For Solana, using a purple color that is commonly associated with the Solana logo
  sol: COLOR.purple,
} as const;

const ADDRESS_TYPE = {
  BTC: {
    singleSig: {
      P2WPKH: 'witnesspubkeyhash',
      P2PKH: 'pubkeyhash',
      P2TR: 'taproot'
    },
    multiSig: {
      P2WSH: 'witnessscripthash',
      P2SH: 'scripthash',
    },
    thresholdSig: {
      P2WSH: 'witnessscripthash',
      P2PKH: 'pubkeyhash',
      // TSS doesn't support schnorr sigs, hence no P2TR
    }
  },
  BCH: {
    singleSig: {
      P2PKH: 'pubkeyhash',
    },
    multiSig: {
      P2SH: 'scripthash'
    },
    thresholdSig: {
      P2PKH: 'pubkeyhash',
    }
  },
  LTC: {
    singleSig: {
      P2WPKH: 'witnesspubkeyhash',
      P2PKH: 'pubkeyhash',
    },
    multiSig: {
      P2WSH: 'witnessscripthash',
      P2SH: 'scripthash',
    },
    thresholdSig: {
      P2WPKH: 'witnesspubkeyhash',
      P2PKH: 'pubkeyhash',
    }
  },
  DOGE: {
    singleSig: {
      P2PKH: 'pubkeyhash',
    },
    multiSig: {
      P2SH: 'scripthash'
    },
    thresholdSig: {
      P2PKH: 'pubkeyhash',
    }
  },
  default: 'pubkeyhash'
} as const;

export const Constants = {
  UNITS2,
  COIN,
  PUBLIC_API,
  COLOR,
  CHAIN_COLOR,
  ADDRESS_TYPE,
} as const;

export const bitcoreLogo = `
 _     _ _                     
| |   (_) |                    
| |__  _| |_ ___ ___  _ __ ___ 
| '_ \\| | __/ __/ _ \\| '__/ _ \\
| |_) | | || (_| (_) | | |  __/
|_.__/|_|\\__\\___\\___/|_|  \\___|
                               
`;
