const config = {
  full_node: true,
  logging: 'debug',
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
    json_spaces: 2,
  },
};

module.exports = config;
