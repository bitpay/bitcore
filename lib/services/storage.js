'use strict';
var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var config = require('../config');
require('../models/wallet');
require('../models/walletAddress');
require('../models/transaction');
require('../models/block');

var StorageService = function(){
};

StorageService.prototype.start = function(ready) {
  mongoose.connect('mongodb://' + config.dbHost + '/fullNodePlus?socketTimeoutMS=3600000&noDelay=true', {
    useMongoClient: true,
    keepAlive: 15,
    poolSize: config.maxPoolSize
  }, ready);
};

StorageService.prototype.stop = function() {

};

StorageService.prototype.apiStreamingFind = function(model,query,limit,params,res){
  var cursor = model.find(query).limit(limit).cursor({transform: model._apiTransform});
  cursor.on('error', function(err) {
    return res.status(500).end(err.message);
  });
  var isFirst = true;
  res.type('json');
  cursor.on('data', function(data){
    if(isFirst){
      res.write('[');
      isFirst = false;
    } else{
      res.write(',');
    }
    res.write(data);
  });
  cursor.on('end', function(){
    res.write(']');
    res.end();
  });
};

module.exports = new StorageService();