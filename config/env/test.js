'use strict';

module.exports = {
  db: "mongodb://localhost/mystery-dev",
  app: {
    name: "Mystery - Test"
  },
  bitcoind: {
    user: 'mystery',
    pass: 'real_mystery',
    protocol: 'http',
    host: process.env.BITCOIND_HOST  || '127.0.0.1',
    port: process.env.BITCOIND_PORT  || '8332',
  },
  network: 'testnet',
}
