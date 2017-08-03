const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InputSchema = new Schema({
  utxo: String,
  vout: Number,
  address: String,
  amount: Number,
});

const OutputSchema = new Schema({
  address: String,
  amount: Number,
  vout: Number,
});

const TransactionSchema = new Schema({
  txid: String,
  version: Number,
  lockTime: Number,
  vin: [InputSchema],
  vout: [OutputSchema],
  blockHash: String,
  blockHeight: Number,
  confirmations: Number,
  time: Date,
  blockTime: Date,
  blockTimeNormalized: Date,
  valueOut: Number,
  size: Number,
  valueIn: Number,
  fees: Number,
  chain: String,
});

TransactionSchema.index({ txid: 1 }, { unique: true });
TransactionSchema.index({ blockHeight: 1, wallets: 1 });
TransactionSchema.index({ blockHash: 1 });
TransactionSchema.index({ blockTime: 1 });
TransactionSchema.index({ blockTimeNormalized: 1, wallets: 1 });

TransactionSchema.index({ 'outputs.address': 1 });
TransactionSchema.index({ 'inputs.address': 1 });
TransactionSchema.index({ wallets: 1 }, { sparse: true });
TransactionSchema.index({ 'inputs.wallets': 1 }, { sparse: true });
TransactionSchema.index({ 'outputs.wallets': 1 }, { sparse: true });

const Transaction = mongoose.model('Transaction', TransactionSchema);
const Input = mongoose.model('Input', InputSchema);
const Output = mongoose.model('Output', OutputSchema);

module.exports = {
  Transaction,
  Input,
  Output
};
