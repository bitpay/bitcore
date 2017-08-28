const Block = require('../models/block.js');
const logger = require('../logger');
const config = require('../../config');


let bestBlockHeight = 0;

// 1e9 limit = ~2M years from now
// Mostly for sync to set height
function bestHeight(height) {
  height = parseInt(height, 10) || 0;
  if (Number.isInteger(height) &&
    height > 0 &&
    height < 1 * 1e9) {
    bestBlockHeight = height;
    return bestBlockHeight;
  }
  return bestBlockHeight;
}

function getRawBlock(hash, cb) {
  return Block.getRawBlock(hash, cb);
}

function byHeight(height, cb) {
  return Block.byHeight(height, cb);
}

function getTopBlocks(cb) {
  return Block.last(cb);
}

function getByHash(hash, cb) {
  return Block.byHash(hash, cb);
}

function getLastBlock(cb) {
  return Block.last(cb)
    .limit(1);
}

function saveBcoinBlock(entry, block, cb) {
  return Block.saveBcoinBlock(entry, block, cb);
}

// Returns highest consecutive block height
function getBestBlockHeight(cb) {
  logger.log('debug',
    'Verifying Mongo Blockchain');
  return Block.getHeights((err, blocks) => {
    if (err) {
      return cb(err);
    }
    // Blocks are in ascending order
    let lastGoodHeight = 0;
    blocks.forEach((block) => {
      if (lastGoodHeight === block.height - 1) {
        lastGoodHeight = block.height;
      }
    });
    return cb(null, lastGoodHeight);
  });
}

module.exports = {
  getBestBlockHeight,
  getRawBlock,
  getTopBlocks,
  getLastBlock,
  getByHash,
  byHeight,
  bestHeight,
  saveBcoinBlock,
};
