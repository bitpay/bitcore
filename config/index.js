const config = {
  start_node: true,
  logging: 'debug',
  bcoin: {
    network: 'main',
    db: 'leveldb',
    checkpoints: true,
    workers: true,
    logLevel: 'info',
    'max-inbound': 10,
    'max-outbound': 10,
  },
  mongodb: {
    uri: 'mongodb://localhost/bitcore',
    options: {
      useMongoClient: true,
    },
  },
  api: {
    port: 80,
    json_spaces: 2,
    currency_refresh: 60,
    ticker_url: 'https://www.bitstamp.net/api/ticker/',
  },
};

module.exports = config;
