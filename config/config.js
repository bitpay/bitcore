'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    rootPath = path.normalize(__dirname + '/..');

module.exports = {
  root: rootPath,
  appName: 'Insight',
  port: process.env.PORT || 3000,
  db: 'mongodb://localhost/insight-test',
  bitcoind: {
    protocol:  process.env.BITCOIND_PROTO || 'http',
    user: process.env.BITCOIND_USER || 'user',
    pass: process.env.BITCOIND_PASS || 'pass',
    host: process.env.BITCOIND_HOST || '127.0.0.1',
    port: process.env.BITCOIND_PORT || '18332',
    p2pPort: process.env.BITCOIND_P2P_PORT || '18333',

    // DO NOT CHANGE THIS!
    disableAgent: true
  },
  network: process.env.INSIGHT_NETWORK || 'testnet',
  disableP2pSync: false,
  disableHistoricSync: false,
};
