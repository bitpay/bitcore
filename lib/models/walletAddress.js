'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var WalletAddressSchema = new Schema({
  wallet: Schema.Types.ObjectId,
  address: String
});

WalletAddressSchema.index({address: 1, wallet: 1});


module.exports = mongoose.model('WalletAddress', WalletAddressSchema);