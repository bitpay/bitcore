export const Constants = {
  UNITS2: {
    'btc': 100000000,
    'bit': 100,
    'sat': 1,
  },
  COIN: {
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
  },
  PUBLIC_API: {
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
  },
  COLOR: {
    green: '\x1b[32m%s\x1b[0m',
    red: '\x1b[31m%s\x1b[0m',
    yellow: '\x1b[33m%s\x1b[0m',
    blue: '\x1b[34m%s\x1b[0m',
    orange: '\x1b[38;5;208m%s\x1b[0m',
    none: '\x1b[0m%s',
  },
  ADDRESS_TYPE: {
    BTC: {
      singleSig: {
        P2WPKH: 'witnesspubkeyhash',
        P2PKH: 'pubkeyhash',
        P2TR: 'taproot'
      },
      multiSig: {
        P2WSH: 'witnessscripthash',
        P2SH: 'scripthash',
      }
    },
    BCH: {
      singleSig: {
        P2PKH: 'pubkeyhash',
      },
      multiSig: {
        P2SH: 'scripthash'
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
      }      
    },
    DOGE: {
      singleSig: {
        P2PKH: 'pubkeyhash',
      },
      multiSig: {
        P2SH: 'scripthash'
      }
    },
    default: 'scripthash'
  }
};

export const bitcoreLogo = `
 _     _ _                     
| |   (_) |                    
| |__  _| |_ ___ ___  _ __ ___ 
| '_ \\| | __/ __/ _ \\| '__/ _ \\
| |_) | | || (_| (_) | | |  __/
|_.__/|_|\\__\\___\\___/|_|  \\___|
                               
`;
