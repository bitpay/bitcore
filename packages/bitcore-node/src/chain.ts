module.exports = {
  BTC: {
    lib: require('bitcore-lib'),
    p2p: require('bitcore-p2p')
  },
  BCH: {
    lib: require('bitcore-lib-cash'),
    p2p: require('bitcore-p2p-cash')
  },
  BCHA: {
    lib: require('bitcore-lib-cash'),
    p2p: require('bitcore-p2p-bcha')
  },
  XPI: {
    lib: require('@abcpros/bitcore-lib-xpi'),
    p2p: require('@abcpros/bitcore-p2p-xpi')
  }
};
