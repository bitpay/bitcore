var Providers = {
  CryptoCompare: require('./cryptocompare'),
  Coingecko: require('./coingecko'),
  LotusExplorer: require('./lotusexplorer'),
  BitPay: require('./bitpay')
  //  Bitstamp: require('./bitstamp'), // no longer used
};

module.exports = Providers;
