var Providers = {
  CryptoCompare: require('./cryptocompare'),
  Coingecko: require('./coingecko'),
  LotusExplorer: require('./lotusexplorer'),
  BitPay: require('./bitpay'),
  LotusExbitron: require('./lotus-exbitron'),
  EtokenPrice: require('./etoken-price')
  //  Bitstamp: require('./bitstamp'), // no longer used
};

module.exports = Providers;
