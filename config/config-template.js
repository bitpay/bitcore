const config = {
  bcoin: {
    network: 'main',
    db: 'leveldb',
    checkpoints: true,
    workers: true,
    logLevel: 'info',
  },
  mongodb: {
    uri: 'mongodb://localhost/bitcore',
    options: {
      useMongoClient: true,
    },
  },
};

module.exports = config;
