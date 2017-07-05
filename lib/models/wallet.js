'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var WalletSchema = new Schema({
  addresses: [String]
});


module.exports = mongoose.model('Wallet', WalletSchema);