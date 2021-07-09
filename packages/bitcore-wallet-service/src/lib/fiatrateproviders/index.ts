var Providers = {
  CryptoCompare: require('./cryptocompare'),
  LotusExplorer: require('./lotusexplorer'),
  BitPay: require('./bitpay')
  //  Bitstamp: require('./bitstamp'), // no longer used
};

module.exports = Providers;
