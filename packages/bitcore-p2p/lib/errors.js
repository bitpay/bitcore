'use strict';

const spec = {
  name: 'P2P',
  message: 'Internal Error on bitcore-p2p Module {0}'
};

module.exports = require('@bitpay-labs/bitcore-lib').errors.extend(spec);
