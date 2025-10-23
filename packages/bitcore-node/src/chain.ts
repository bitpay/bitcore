import BitcoreLib from 'bitcore-lib';
import BitcoreLibCash from 'bitcore-lib-cash';
import BitcoreP2P from 'bitcore-p2p';
import BitcoreP2PCash from 'bitcore-p2p-cash';

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
