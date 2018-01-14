var mongoose = require('mongoose');
mongoose.Promise = global.Promise;
var config = require('../config');
require('../models/coin');
require('../models/wallet');
require('../models/walletAddress');
require('../models/transaction');
require('../models/block');
var StorageService = function(){
};

StorageService.prototype.start = function(ready) {
  mongoose.connect('mongodb://' + config.dbHost + '/fullNodePlusUTXO?socketTimeoutMS=3600000&noDelay=true&compressors=snappy', {
    keepAlive: true,
    poolSize: config.maxPoolSize,
    'native_parser': true
  }, ready);
};

StorageService.prototype.stop = function() {

};

StorageService.prototype.apiStreamingFind = function(model,query,params,res){
  var cursor = model.find(query).cursor({transform: model._apiTransform});
  cursor.on('error', function(err) {
    return res.status(500).end(err.message);
  });
  var isFirst = true;
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
    res.write(']');
    res.end();
  });
};

module.exports = new StorageService();