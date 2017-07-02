'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Input = new Schema({
  utxo: String,
  vout: Number,
  address: String,
  amount: Number
});

var Output = new Schema({
  address: String,
  amount: Number,
  vout: Number
});

var TransactionSchema = new Schema({
  txid: String,
  chain: String,
  blockHeight: Number,
  blockHash: String,
  inputs: [Input],
  outputs: [Output],
  wallets: {type : [Schema.Types.ObjectId]},
  coinbase: Boolean,
  fee: Number
});

TransactionSchema.index({txid:1});
TransactionSchema.index({blockHeight:1});
TransactionSchema.index({blockHash:1});
TransactionSchema.index({'outputs.address':1});
TransactionSchema.index({'inputs.address':1});

module.exports = mongoose.model('Transaction', TransactionSchema);