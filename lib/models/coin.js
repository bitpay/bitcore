'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Coin = new Schema({
  mintTxid: String,
  mintIndex: Number,
  coinbase: Boolean,
  value: Number,
  address: String,
  wallets: {type: [Schema.Types.ObjectId]},
  spentTxid: String
});

Coin.index({mintTxid: 1, mintIndex: 1});
Coin.index({address: 1});
Coin.index({wallets: 1}, {sparse: true});
Coin.index({spentTxid: 1}, {sparse: true});

var Coin = module.exports = mongoose.model('Coin', Coin);