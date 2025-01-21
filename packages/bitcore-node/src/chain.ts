module.exports = {
  BTC: {
    lib: require('@bcpros/bitcore-lib'),
    p2p: require('@abcpros/bitcore-p2p')
  },
  BCH: {
    lib: require('@bcpros/bitcore-lib-cash'),
    p2p: require('@abcpros/bitcore-p2p-cash')
  },
  XEC: {
    lib: require('@bcpros/bitcore-lib-xec'),
    p2p: require('@bcpros/bitcore-p2p-xec')
  },
  XPI: {
    lib: require('@bcpros/bitcore-lib-xpi'),
    p2p: require('@bcpros/bitcore-p2p-xpi')
  }
};
