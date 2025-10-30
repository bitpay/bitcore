'use strict';

import * as CWC from 'crypto-wallet-core';

export const Constants = {
  SCRIPT_TYPES: CWC.Constants.SCRIPT_TYPES,
  // not used, since Credentials 2.0
  DERIVATION_STRATEGIES: {
    BIP44: 'BIP44',
    BIP45: 'BIP45',
    BIP48: 'BIP48',
    BIP84: 'BIP84'
  },
  PATHS: {
    SINGLE_ADDRESS: 'm/0/0',
    REQUEST_KEY: "m/1'/0",
    //  TXPROPOSAL_KEY: "m/1'/1",
    REQUEST_KEY_AUTH: 'm/2' // relative to BASE
  },
  BIP45_SHARED_INDEX: 0x80000000 - 1,
  CURVES: {
    ED25519: 'ed25519' as const,
    SECP256K1: 'secp256k1' as const,
  },
  ALGOS: {
    EDDSA: 'EDDSA' as const,
    ECDSA: 'ECDSA' as const,
  },
  CURVE_KEY: {
    ED25519: 'ed25519' as const,
    BITCOIN: 'bitcoin' as const,
  },

  // there is no need to add new entries here ( only for backwards compatiblity )
  BITPAY_SUPPORTED_ETH_ERC20: [
    'matic',
    'usdc',
    'pyusd',
    'pax',
    'gusd',
    'busd',
    'dai',
    'wbtc',
    'shib',
    'ape',
    'euroc',
    'usdt'
  ],

  CHAINS: CWC.Constants.CHAINS,
  UTXO_CHAINS: CWC.Constants.UTXO_CHAINS,
  EVM_CHAINS: CWC.Constants.EVM_CHAINS,
  SVM_CHAINS: CWC.Constants.SVM_CHAINS,
  RIPPLE_CHAINS: CWC.Constants.RIPPLE_CHAINS,
  MULTISIG_CHAINS: CWC.Constants.MULTISIG_CHAINS,
  ETH_TOKEN_OPTS: CWC.Constants.ETH_TOKEN_OPTS,
  MATIC_TOKEN_OPTS: CWC.Constants.MATIC_TOKEN_OPTS,
  ARB_TOKEN_OPTS: CWC.Constants.ARB_TOKEN_OPTS,
  BASE_TOKEN_OPTS: CWC.Constants.BASE_TOKEN_OPTS,
  OP_TOKEN_OPTS: CWC.Constants.OP_TOKEN_OPTS,
  SOL_TOKEN_OPTS: CWC.Constants.SOL_TOKEN_OPTS,
  UNITS: CWC.Constants.UNITS,
  EVM_CHAINSUFFIXMAP: {
    eth: 'e',
    matic: 'm',
    arb: 'arb',
    base: 'base',
    op: 'op',
  }
};
