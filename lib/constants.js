'use strict';
module.exports = {
  numWorkers: require('os').cpus().length,
  maxPoolSize: 10
};