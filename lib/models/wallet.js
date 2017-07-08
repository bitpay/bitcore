'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var WalletSchema = new Schema({
  name: String
});


module.exports = mongoose.model('Wallet', WalletSchema);