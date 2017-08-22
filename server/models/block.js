const mongoose = require('mongoose');
const config = require('../config');

const Schema = mongoose.Schema;
// These limits can be overriden higher up the stack
const MAX_BLOCKS = config.api.max_blocks;

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

BlockSchema.methods.byHeight = function blockByHeight(height, cb) {
  return this.model('Block').findOne(
    { height },
    cb);
};

BlockSchema.methods.byHash = function byHash(hash, cb) {
  return this.model('Block').findOne(
    { hash },
    cb);
};

BlockSchema.methods.getRawBlock = function getRawBlock(hash, cb) {
  return this.model('Block').findOne(
    { hash },
    { rawBlock: 1 },
    cb);
};

BlockSchema.methods.last = function lastBlocks(cb) {
  return this.model('Block').find(
    {},
    cb)
    .limit(MAX_BLOCKS)
    .sort({ height: -1 });
};

module.exports = mongoose.model('Block', BlockSchema);
