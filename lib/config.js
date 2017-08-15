'use strict';
var Config = function(){
  var config = {
    chainSource: 'bcoin',
    network: 'testnet',
    numWorkers: require('os').cpus().length,
    maxPoolSize: 10,
    port: 3000,
    dbHost: '127.0.0.1'
  };

  var options;
  try {
    options = require('../config.json');
  } catch(e) {
    options = {};
  }

  Object.assign(config, options);
  return config;
};

module.exports = new Config();