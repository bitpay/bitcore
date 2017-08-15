const config = {
  start_node: true,
  logging: 'debug',
  bcoin_http: 'localhost',
  bcoin: {
    network: 'main',
    db: 'leveldb',
    prefix: '.',
    checkpoints: true,
    workers: false,
    logLevel: 'info',
    'max-inbound': 10,
    'max-outbound': 10,
    'index-tx': true,
    'index-address': true,
    'http-port': 8332,
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
