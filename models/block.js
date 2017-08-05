const mongoose = require('mongoose');

const Schema = mongoose.Schema;

const BlockSchema = new Schema({
  hash:       String,
  height:     Number,
  version:    Number,
  size:       Number,
  prevBlock:  String,
  merkleRoot: String,
  ts:         Number,
  bits:       Number,
  nonce:      Number,
  txs:        Array,
  chainwork:  Number,
  reward:     Number,
  network:    String,
  poolInfo:   Object,
  rawBlock:   String,
});

const Block = mongoose.model('Block', BlockSchema);

module.exports = Block;
