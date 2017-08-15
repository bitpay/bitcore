const pkg = require('../../package.json');

const logger = require('../logger');

module.exports = function statusAPI(router) {
  router.get('/status', (req, res) => {
    res.json({
      info: {
        version:         0,
        protocolversion: 0,
        blocks:          0,
        timeoffset:      0,
        connections:     0,
        proxy:           '',
        difficulty:      0,
        testnet:         false,
        relayfee:        0,
        errors:          '',
        network:         'main',
      },
    });
  });

  router.get('/sync', (req, res) => {
    res.json({
      status: '',
      blockChainHeight: 0,
      syncPercentage: 0,
      height: 0,
      error: null,
      type: 'bitcore node',
    });
  });

  router.get('/peer', (req, res) => {
    res.json({
      connected: true,
      host: '127.0.0.1',
      port: null,
    });
  });

  router.get('/version', (req, res) => {
    res.json({
      version: pkg.version,
    });
  });
};
