import BitcoreP2P from '@bitpay-labs/bitcore-p2p';
import BitcoreP2PCash from '@bitpay-labs/bitcore-p2p-cash';
import { BitcoreLib, BitcoreLibCash } from '@bitpay-labs/crypto-wallet-core';

export default {
  BTC: {
    lib: BitcoreLib,
    p2p: BitcoreP2P
  },
  BCH: {
    lib: BitcoreLibCash,
    p2p: BitcoreP2PCash
  }
};
