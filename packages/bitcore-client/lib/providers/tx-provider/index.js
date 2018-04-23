const providers = {
  BTC: require('./btc'),
  BCH: require('./bch')
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

module.exports =  new TxProvider();
