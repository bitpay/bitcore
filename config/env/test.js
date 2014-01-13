'use strict';

module.exports = {
  db: "mongodb://localhost/mystery-test",
  app: {
    name: "Mystery - Test"
  },
  port: '3301',
  bitcoind: {
    protocol:  process.env.BITCOIND_PROTO  ||  'http',
    user: process.env.BITCOIND_USER  || 'mystery',
    pass: process.env.BITCOIND_PASS  || 'real_mystery',
    host: process.env.BITCOIND_HOST  || '127.0.0.1',
    port: process.env.BITCOIND_PORT  || '18332',
  },
  network: 'testnet',
}
