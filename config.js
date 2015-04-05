var config = {
  basePath: '/bws/api',
  disableLogs: false,
  BlockchainMonitor: {
    livenet: {
      name: 'insight',
      url: 'https://insight.bitpay.com:443',
    },
    testnet: {
      name: 'insight',
      url: 'https://test-insight.bitpay.com:443',
    },
  },
  WalletService: {
    storageOpts: {
      dbPath: './db',
      /*
      dbHost: 'http://db.host.org',
      dbPort: '8188',
       */
    },
  },
};
module.exports = config;
