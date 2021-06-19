var Providers = {
  CryptoCompare: require('./cryptocompare'),
  BitPay: require('./bitpay')
  //  Bitstamp: require('./bitstamp'), // no longer used
};

module.exports = Providers;
