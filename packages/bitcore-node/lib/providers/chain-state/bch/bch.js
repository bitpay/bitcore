const BTCStateProvider = require('../btc/btc');
const util = require('util');

function BCHStateProvider() {
  BTCStateProvider.call(this, 'BCH');
}
util.inherits(BCHStateProvider, BTCStateProvider);

module.exports = BCHStateProvider;
