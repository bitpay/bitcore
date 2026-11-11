'use strict';

var spec = {
  name: 'P2P',
  message: 'Internal Error on bitcore-p2p Module {0}'
};

module.exports = require('@bitpay-labs/bitcore-lib-doge').errors.extend(spec);
