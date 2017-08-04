const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const BlockSchema = new Schema({
  hash: String,
  size: Number,
  height: Number,
  version: Number,
  merkleRoot: String,
  tx: Array,
  time: Number,
  nonce: Number,
  bits: Number,
  difficulty: Number,
  chainwork: Number,
  confirmations: Number,
  previousBlockHash: String,
  nextBlockHash: String,
  reward: Number,
  timeNormalized: Date,
  isMainChain: Boolean,
  poolInfo: Object,
  transactionCount: Number,
  rawBlock: String,
});

BlockSchema.index({ hash: 1 }, { unique: true });
BlockSchema.index({ height: 1 });
BlockSchema.index({ time: 1 });
BlockSchema.index({ timeNormalized: 1 });

const Block = mongoose.model('Block', BlockSchema);

module.exports = Block;
