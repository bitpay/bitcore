'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var Input = new Schema({
  utxo: String,
  vout: Number,
  address: String,
  amount: Number,
  wallets: {type: [Schema.Types.ObjectId] }
});

var Output = new Schema({
  address: String,
  amount: Number,
  vout: Number,
  wallets: { type: [Schema.Types.ObjectId] }
});

var TransactionSchema = new Schema({
  txid: String,
  chain: String,
  blockHeight: Number,
  blockHash: String,
  blockTime: Date,
  blockTimeNormalized: Date,
  inputs: [Input],
  outputs: [Output],
  coinbase: Boolean,
  fee: Number,
  inputsProcessed: Boolean,
  wallets: { type: [Schema.Types.ObjectId] }
});

TransactionSchema.index({ txid: 1 }, {unique:true});
TransactionSchema.index({ blockHeight: 1 });
TransactionSchema.index({ blockHash: 1 });

TransactionSchema.index({ 'outputs.address': 1 });
TransactionSchema.index({ 'inputs.address': 1 });
TransactionSchema.index({ 'wallets': 1 }, { sparse: true });
TransactionSchema.index({ 'inputs.wallets': 1 }, { sparse: true });
TransactionSchema.index({ 'outputs.wallets': 1 }, { sparse: true });

module.exports = mongoose.model('Transaction', TransactionSchema);