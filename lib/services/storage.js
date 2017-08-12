'use strict';

var mongoose = require('mongoose');
var config = require('../config');
require('../models/wallet');
require('../models/walletAddress');
require('../models/transaction');
require('../models/block');

var StorageService = function(){
};

StorageService.prototype.start = function(ready) {
  mongoose.connect('mongodb://' + config.dbHost + '/fullNodePlus?socketTimeoutMS=3600000&noDelay=true', {
    keepAlive: 15,
    poolSize: config.maxPoolSize
  }, ready);
};

StorageService.prototype.stop = function() {

};

module.exports = new StorageService();