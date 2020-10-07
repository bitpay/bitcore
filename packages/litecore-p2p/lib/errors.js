'use strict';

var spec = {
  name: 'P2P',
  message: 'Internal Error on litecore-p2p Module {0}'
};

module.exports = require('litecore-lib').errors.extend(spec);
