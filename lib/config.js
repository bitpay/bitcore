const Config = function(){
  let config = {
    maxPoolSize: 20,
    port: 3000,
    dbHost: process.env.DB_HOST || '127.0.0.1',
    dbName: process.env.DB_NAME || 'bitcore',
    numWorkers: require('os').cpus().length,
    chains: {}
  };

  let options;
  try {
    options = require('../config.json');
  } catch(e) {
    options = {};
  }

  Object.assign(config, options);
  if (!Object.keys(config.chains).length){
    config.chains.BTC = {
      mainnet: {
        chainSource: 'p2p',
          trustedPeers: [
            { host: '127.0.0.1', port: 8333 }
          ]
      }
    };
  }

  return config;
};

module.exports = new Config();
