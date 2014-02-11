'use strict';

var path = require('path'),
    rootPath = path.normalize(__dirname + '/..'),
    env,
    db = './db/testnet',
    port = '3000',
    b_port = '18332',
    p2p_port = '18333';

switch(process.env.NODE_ENV) {
  case 'production':
    if (process.env.INSIGHT_NETWORK === 'livenet') {
      env = 'livenet';
      db = './db';
      b_port = '8332';
      p2p_port = '8333';
    }
    else {
      env = 'testnet';
      port = '3001';
    }
    break;
  case 'test':
    env = 'test environment';
    break;
  default:
    env = 'development';
    break;
}

module.exports = {
  root: rootPath,
  appName: 'Insight ' + env,
  port: port,
  leveldb: db,
  bitcoind: {
    protocol:  process.env.BITCOIND_PROTO || 'http',
    user: process.env.BITCOIND_USER || 'user',
    pass: process.env.BITCOIND_PASS || 'pass',
    host: process.env.BITCOIND_HOST || '127.0.0.1',
    port: b_port,
    p2pPort: p2p_port,
    dataDir: (process.env.BITCOIND_DATADIR +
       ((process.env.INSIGHT_NETWORK || 'testnet')==='testnet'?'testnet3':'')),

    // DO NOT CHANGE THIS!
    disableAgent: true
  },
  network: process.env.INSIGHT_NETWORK || 'testnet',
  disableP2pSync: false,
  disableHistoricSync: false,

  // Time to refresh the currency rate. In minutes
  currencyRefresh: 10
};
