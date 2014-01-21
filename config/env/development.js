'use strict';

module.exports = {
  db: 'mongodb://localhost/insight-dev',
  app: {
    name: 'Insight - Development'
  },
  bitcoind: {
    protocol:  process.env.BITCOIND_PROTO  ||  'http',
    user: process.env.BITCOIND_USER  || 'user',
    pass: process.env.BITCOIND_PASS  || 'pass',
    host: process.env.BITCOIND_HOST  || '127.0.0.1',
    port: process.env.BITCOIND_PORT  || '18332',
    disableAgent: true,
  },
  network: process.env.INSIGHT_NETWORK || 'testnet',
  disableP2pSync: false,
  disableHistoricSync: false,
};
