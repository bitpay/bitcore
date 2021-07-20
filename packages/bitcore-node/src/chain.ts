module.exports = {
  BTC: {
    lib: require('@abcpros/bitcore-lib'),
    p2p: require('bitcore-p2p')
  },
  BCH: {
    lib: require('@abcpros/bitcore-lib-cash'),
    p2p: require('bitcore-p2p-cash')
  },
  XEC: {
    lib: require('@abcpros/bitcore-lib-xec'),
    p2p: require('bitcore-p2p-xec')
  },
  XPI: {
    lib: require('@abcpros/bitcore-lib-xpi'),
    p2p: require('@abcpros/bitcore-p2p-xpi')
  }
};
