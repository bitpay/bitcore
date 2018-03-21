const BTCStateProvider = require('../btc/btc');
const util = require('util');

function BCHStateProvider(chain) {
  this.chain = chain.toUpperCase() || 'BCH';
}
util.inherits(BCHStateProvider, BTCStateProvider);

module.exports = BCHStateProvider;
