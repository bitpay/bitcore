'use strict';

var spec = {
  name: 'P2P',
  message: 'Internal Error on bitcore-p2p Module {0}'
};

module.exports = require('@bcpros/bitcore-lib-cash').errors.extend(spec);
