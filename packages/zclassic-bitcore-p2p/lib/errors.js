'use strict';

var spec = {
  name: 'P2P',
  message: 'Internal Error on zclassic-bitcore-p2p Module {0}'
};

module.exports = require('zclassic-bitcore-lib').errors.extend(spec);
