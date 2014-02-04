'use strict';

/**
 * Module dependencies.
 */
var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
    env;

switch(process.env.NODE_ENV) {
  case 'production':
    env = 'prod';
  break;
  case 'test':
    env = 'test';
  break;
  default:
    env = 'dev';
  break;
}

module.exports = {
  root: rootPath,
  appName: 'Insight ' + env,
  port: process.env.PORT || 3000,
  db: 'mongodb://localhost/insight-' + env,
  leveldb: './db',
  bitcoind: {
    protocol:  process.env.BITCOIND_PROTO || 'http',
    user: process.env.BITCOIND_USER || 'user',
    pass: process.env.BITCOIND_PASS || 'pass',
    host: process.env.BITCOIND_HOST || '127.0.0.1',
    port: process.env.BITCOIND_PORT || '18332',
    p2pPort: process.env.BITCOIND_P2P_PORT || '18333',
    dataDir: process.env.BITCOIND_DATADIR || './testnet3',

    // DO NOT CHANGE THIS!
    disableAgent: true
  },
  network: process.env.INSIGHT_NETWORK || 'testnet',
  disableP2pSync: false,
  disableHistoricSync: false,
};
