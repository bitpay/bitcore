const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const InputSchema = new Schema({
  utxo: String,
  vout: Number,
  address: String,
  amount: Number,
  wallets: { type: [Schema.Types.ObjectId] },
});

const OutputSchema = new Schema({
  address: String,
  amount: Number,
  vout: Number,
  wallets: { type: [Schema.Types.ObjectId] },
});

const TransactionSchema = new Schema({
  txid: String,
  chain: String,
  blockHeight: Number,
  blockHash: String,
  blockTime: Date,
  blockTimeNormalized: Date,
  inputs: [InputSchema],
  outputs: [OutputSchema],
  coinbase: Boolean,
  fee: Number,
  inputsProcessed: Boolean,
  wallets: { type: [Schema.Types.ObjectId] },
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
