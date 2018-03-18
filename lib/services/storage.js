const mongoose = require('mongoose');
const config = require('../config');
require('../models/coin');
require('../models/walletAddress');
require('../models/wallet');
require('../models/transaction');
require('../models/block');

const StorageService = function(){
};

StorageService.prototype.start = function(ready) {
  mongoose.connect(`mongodb://${config.dbHost}/${config.dbName}?socketTimeoutMS=3600000&noDelay=true`, {
    keepAlive: true,
    poolSize: config.maxPoolSize,
    'native_parser': true
  }, ready);
};

StorageService.prototype.stop = function() {

};

StorageService.prototype.apiStreamingFind = function(model,query,params,res){
  let cursor = model.find(query).cursor({transform: model._apiTransform});
  cursor.on('error', function(err) {
    return res.status(500).end(err.message);
  });
  let isFirst = true;
  res.type('json');
  cursor.on('data', function(data){
    if(isFirst){
      res.write('[\n');
      isFirst = false;
    } else{
      res.write(',\n');
    }
    res.write(data);
  });
  cursor.on('end', function(){
    if(isFirst) {
      // there was no data
      res.write('[]');
    } else {
      res.write(']');
    }
    res.end();
  });
};

module.exports = new StorageService();
