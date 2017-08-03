const config = {
  bcoin: {
    network: 'main',
    db: 'leveldb',
    checkpoints: true,
    workers: true,
    logLevel: 'info',
    'max-inbound': 100,
  },
  mongodb: {
    uri: 'mongodb://localhost/bitcore',
    options: {
      useMongoClient: true,
    },
  },
  api: {
    port: 3000,
  },
};

module.exports = config;
