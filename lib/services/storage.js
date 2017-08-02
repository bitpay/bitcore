'use strict';

var mongoose = require('mongoose');
var constants = require('../constants');
require('../models/wallet');
require('../models/walletAddress');
require('../models/transaction');
require('../models/block');

var StorageService = function(){
};

StorageService.prototype.start = function(ready) {
  mongoose.connect('mongodb://localhost/fullNodePlus?socketTimeoutMS=3600000&noDelay=true', {
    keepAlive: 15,
    poolSize: constants.maxPoolSize
  }, ready);
};

StorageService.prototype.stop = function() {

};

module.exports = new StorageService();