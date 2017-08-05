const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

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

const Transaction = mongoose.model('Transaction', TransactionSchema);
const Input = mongoose.model('Input', InputSchema);
const Output = mongoose.model('Output', OutputSchema);

module.exports = {
  Transaction,
  Input,
  Output,
};
