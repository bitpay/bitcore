const config = {
  full_node: false,
  logging: 'debug',
  bcoin: {
    network: 'main',
    db: 'leveldb',
    checkpoints: true,
    workers: true,
    logLevel: 'info',
    'max-inbound': 100,
    'max-outbound': 100,
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
    currency_refresh: 60,
    ticker_url: 'https://www.bitstamp.net/api/ticker/',
  },
};

module.exports = config;
