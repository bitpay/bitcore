const pkg = require('../../package.json');

module.exports = function statusAPI(router) {
  router.get('/status', (req, res) => {
    res.json({
      info: {
        version: 120100,
        protocolversion: 70012,
        blocks: 479275,
        timeoffset: 0,
        connections: 79,
        proxy: '',
        difficulty: 8.60222E11,
        testnet: false,
        relayfee: 1.0E-5,
        errors: "Warning: Unknown block versions being mined! It's possible unknown rules are in effect",
        network: 'livenet',
      },
    });
  });

  router.get('/sync', (req, res) => {
    res.send('sync');
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
