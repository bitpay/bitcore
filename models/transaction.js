const mongoose = require('mongoose');
const Input = require('./input');
const Output = require('./output');

const Schema   = mongoose.Schema;

const TransactionSchema = new Schema({
  hash:        String,
  witnessHash: String,
  fee:         Number,
  rate:        Number,
  ps:          Number,
  height:      Number,
  block:       String,
  index:       Number,
  version:     Number,
  flag:        Number,
  lockTime:    Number,
  inputs:      [Input.schema],
  outputs:     [Output.schema],
  size:        Number,
  network:     String,
});

const Transaction = mongoose.model('Transaction', TransactionSchema);

module.exports = {
  Transaction,
};
