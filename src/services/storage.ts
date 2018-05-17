const mongoose = require('mongoose');
const config = require('../config');
const logger = require('../logger.js');
require('../models');

const StorageService = function() {};

StorageService.prototype.start = function(ready, args) {
  let options = Object.assign({}, config, args);
  let { dbName, dbHost } = options;
  const connectUrl = `mongodb://${dbHost}/${dbName}?socketTimeoutMS=3600000&noDelay=true`;
  let attemptConnect = async () => {
    return mongoose.connect(connectUrl, {
      keepAlive: true,
      poolSize: config.maxPoolSize,
      'native_parser': true
    });
  };
  let attempted = 0;
  let attemptConnectId = setInterval(async() => {
    try {
      let data = await attemptConnect();
      clearInterval(attemptConnectId);
      ready(null, data);
    } catch(err) {
      logger.error(err);
      attempted++;
      if(attempted > 5) {
        clearInterval(attemptConnectId);
        ready(err);
      }
    }
  }, 5000);
};

StorageService.prototype.stop = function() {

};

StorageService.prototype.apiStreamingFind = function(model, query, res) {
  let cursor = model.find(query).cursor({
    transform: model._apiTransform
  });
  cursor.on('error', function(err) {
    return res.status(500).end(err.message);
  });
  let isFirst = true;
  res.type('json');
  cursor.on('data', function(data) {
    if (isFirst) {
      res.write('[\n');
      isFirst = false;
    } else {
      res.write(',\n');
    }
    res.write(data);
  });
  cursor.on('end', function() {
    if (isFirst) {
      // there was no data
      res.write('[]');
    } else {
      res.write(']');
    }
    res.end();
  });
};

module.exports = new StorageService();
