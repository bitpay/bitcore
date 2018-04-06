const mongoose = require('mongoose');
const config = require('../config');
require('../models');

const StorageService = function() {};

StorageService.prototype.start = function(ready, args) {
  let options = Object.assign({}, args, config);
  let { dbName, dbHost } = options;
  const connectUrl = `mongodb://${dbHost}/${dbName}?socketTimeoutMS=3600000&noDelay=true`;
  mongoose.connect(connectUrl, {
    keepAlive: true,
    poolSize: config.maxPoolSize,
    'native_parser': true
  }, ready);
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
