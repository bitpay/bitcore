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
    host: process.env.BITCOIND_HOST  || '162.242.219.26',
    port: process.env.BITCOIND_PORT  || '8332',
    disableAgent: true,
  },
  network: process.env.INSIGHT_NETWORK || 'livenet',
  disableP2pSync: false,
  disableHistoricSync: false,
};
