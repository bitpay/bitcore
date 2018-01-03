'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Coin = new Schema({
  network: String,
  mintTxid: String,
  mintIndex: Number,
  mintHeight: Number,
  coinbase: Boolean,
  value: Number,
  address: String,
  wallets: {type: [Schema.Types.ObjectId]},
  spentTxid: String,
  spentHeight: Number
});

Coin.index({mintTxid: 1, mintIndex: 1}, {unique: true});
Coin.index({address: 1});
Coin.index({wallets: 1}, {sparse: true});
Coin.index({spentTxid: 1}, {sparse: true});

var Coin = module.exports = mongoose.model('Coin', Coin);