const mongoose = require('mongoose');
const Transaction = require('./transaction');

const Schema = mongoose.Schema;

const BlockSchema = new Schema({
  hash:       { type: String, default: '' },
  height:     { type: Number, default: 0 },
  size:       { type: Number, default: 0 },
  version:    { type: Number, default: 0 },
  prevBlock:  { type: String, default: '' },
  merkleRoot: { type: String, default: '' },
  ts:         { type: Number, default: 0 },
  bits:       { type: Number, default: 0 },
  nonce:      { type: Number, default: 0 },
  txs:        [{ type: String, default: '' }],
  chainwork:  { type: Number, default: 0 },
  reward:     { type: Number, default: 0 },
  network:    { type: String, default: '' },
  poolInfo:   { type: Object, default: {} },
  rawBlock:   { type: String, default: '' },
}, {
  toJSON: {
    virtuals: true,
  },
  id: false,
});

BlockSchema.index({ hash: 1 });
BlockSchema.index({ height: 1 });

const Block = mongoose.model('Block', BlockSchema);

module.exports = Block;
