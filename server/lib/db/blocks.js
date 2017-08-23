const Block = require('../../models/block.js');
const logger = require('../logger');
const config = require('../../config');

const block = new Block();

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
  return block.getRawBlock(hash, cb);
}

function byHeight(height, cb) {
  return block.byHeight(height, cb);
}

function getTopBlocks(cb) {
  return block.last(cb);
}

function getByHash(hash, cb) {
  return block.byHash(hash, cb);
}

function getLastBlock(cb) {
  return block.last(cb)
    .limit(1);
}

module.exports = {
  getRawBlock,
  getTopBlocks,
  getLastBlock,
  getByHash,
  byHeight,
  bestHeight,
};
