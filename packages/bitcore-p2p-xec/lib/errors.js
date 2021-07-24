'use strict';

var spec = {
  name: 'P2P',
  message: 'Internal Error on bitcore-p2p Module {0}'
};

module.exports = require('@abcpros/bitcore-lib-xec').errors.extend(spec);
