const mongoose = require('mongoose');

const Schema   = mongoose.Schema;

const InputSchema = new Schema({
  prevout:  Object,
  script:   String,
  witness:  String,
  sequence: Number,
  address:  String,
});

const OutputSchema = new Schema({
  address: String,
  script:  String,
  value:   Number,
});

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
  inputs:      [InputSchema],
  outputs:     [OutputSchema],
  size:        Number,
  network:     String,
});

const Transaction = mongoose.model('Transaction', TransactionSchema);
const Input       = mongoose.model('Input', InputSchema);
const Output      = mongoose.model('Output', OutputSchema);

module.exports = {
  Transaction,
  Input,
  Output,
};
