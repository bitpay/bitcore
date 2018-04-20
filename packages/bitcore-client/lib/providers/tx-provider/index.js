const providers = {
  BTC: require('./btc'),
  BCH: require('./bch'),
  ETH: require('./eth')
};

class TxProvider {
  get({ chain }) {
    return providers[chain];
  }

  create(params) {
    return this.get(params).create(params);
  }

  sign(params) {
    return this.get(params).sign(params); 
  }
}

export default new TxProvider();
