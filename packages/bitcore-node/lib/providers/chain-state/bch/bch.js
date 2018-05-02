const BTCStateProvider = require('../btc/btc');

class BCHStateProvider extends BTCStateProvider {
  constructor() {
    super('BCH');
  }
}

module.exports = BCHStateProvider;
