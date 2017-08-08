const mongoose    = require('mongoose');
const Transaction = require('./transaction');

const Schema = mongoose.Schema;

const BlockSchema = new Schema({
  hash:       String,
  height:     Number,
  size:       Number,
  version:    Number,
  prevBlock:  String,
  merkleRoot: String,
  ts:         Number,
  bits:       Number,
  nonce:      Number,
  txs:        [Transaction.schema],
  chainwork:  Number,
  reward:     Number,
  network:    String,
  poolInfo:   Object,
  rawBlock:   String,
}, {
  toJSON: {
    virtuals: true,
  },
  id: false,
});

const Block = mongoose.model('Block', BlockSchema);

module.exports = Block;
