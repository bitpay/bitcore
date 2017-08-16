const mongoose = require('mongoose');
const Input    = require('./input');
const Output   = require('./output');

const Schema   = mongoose.Schema;

const TransactionSchema = new Schema({
  hash:        { type: String, default: '' },
  witnessHash: { type: String, default: '' },
  fee:         { type: Number, default: 0 },
  rate:        { type: Number, default: 0 },
  ps:          { type: Number, default: 0 },
  height:      { type: Number, default: 0 },
  block:       { type: String, default: '' },
  index:       { type: Number, default: 0 },
  version:     { type: Number, default: 0 },
  flag:        { type: Number, default: 0 },
  lockTime:    { type: Number, default: 0 },
  inputs:      [Input.schema],
  outputs:     [Output.schema],
  size:        { type: Number, default: 0 },
  network:     { type: String, default: '' },
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = Transaction;
