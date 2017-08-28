const mongoose = require('mongoose');
const config = require('../../config');
const util = require('../util');

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

BlockSchema.statics.byHeight = function blockByHeight(height, cb) {
  return this.model('Block').findOne(
    { height },
    cb);
};

BlockSchema.statics.byHash = function byHash(hash, cb) {
  return this.model('Block').findOne(
    { hash },
    cb);
};

BlockSchema.statics.getRawBlock = function getRawBlock(hash, cb) {
  return this.model('Block').findOne(
    { hash },
    { rawBlock: 1 },
    cb);
};

BlockSchema.statics.last = function lastBlocks(cb) {
  return this.model('Block').find(
    {},
    cb)
    .limit(MAX_BLOCKS)
    .sort({ height: -1 });
};

BlockSchema.statics.getHeights = function findMissing(cb) {
  return this.model('Block').find(
    {},
    { height: 1 },
    cb)
    .sort({ height: 1 });
};

BlockSchema.statics.saveBcoinBlock = function saveBcoinBlock(entry, block, cb) {
  const Block = this.model('Block');
  const rawBlock = block.toRaw().toString('hex');
  const blockJSON = block.toJSON();
  const reward = util.calcBlockReward(entry.height);

  return new Block({
    hash: blockJSON.hash,
    height: entry.height,
    size: block.getSize(),
    version: blockJSON.version,
    prevBlock: blockJSON.prevBlock,
    merkleRoot: blockJSON.merkleRoot,
    ts: blockJSON.ts,
    bits: blockJSON.bits,
    nonce: blockJSON.nonce,
    txs: block.txs.map((tx) => {
      const txJSON = tx.toJSON();
      return txJSON.hash;
    }),
    chainwork: entry.chainwork,
    reward,
    network: config.bcoin.network,
    poolInfo: {},
    rawBlock,
  }).save(cb);
};

module.exports = mongoose.model('Block', BlockSchema);
