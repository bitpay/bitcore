'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var WalletAddressSchema = new Schema({
  wallet: Schema.Types.ObjectId,
  address: String
});


module.exports = mongoose.model('WalletAddress', WalletAddressSchema);