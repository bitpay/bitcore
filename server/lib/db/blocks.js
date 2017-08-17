const Block = require('../../models/block.js');
const logger = require('../logger');
const config = require('../../config');

const MAX_BLOCKS = config.api.max_blocks; // ~ 12 hours

let bestBlockHeight = 0;

// This naive querying will be replaced by more advanced mongo

function getBlocks(params, options, limit, cb) {
  // Do not return mongo ids
  const defaultOptions = { _id: 0 };
  // Copy over mongo options
  Object.assign(defaultOptions, options);
  // Simple sanitizing
  if (!Number.isInteger(limit)) {
    limit = 1;
  }

  if (limit > MAX_BLOCKS) {
    limit = MAX_BLOCKS;
  }

  if (limit < 1) {
    limit = 1;
  }

  // Query mongo
  Block.find(
    params,
    defaultOptions,
    (err, blocks) => {
      if (err) {
        logger.log('error',
          `getBlocks: ${err}`);
        return cb(err);
      }
      if (!blocks.length > 0) {
        return cb({ err: 'Block not found' });
      }
      return cb(null, blocks);
    })
    .sort({ height: -1 })
    .limit(limit);
}
// Retrieve a single block. For convenience mostly
function getBlock(params, options, limit, cb) {
  getBlocks(params, options, limit, (err, blocks) => {
    if (err) {
      logger.log('error',
        `getBlock: ${err.err}`);
      return cb(err);
    }
    if (!blocks.length > 0) {
      return cb({ err: 'Block not found' });
    }
    return cb(null, blocks[0]);
  });
}
// Highest known height in mongo - Not Used
function getBestHeight() {
  getBlock({}, {}, 1, (err, block) => {
    if (err) {
      logger.log('error',
        `getBestHeight: ${err.err}`);
      return;
    }
    bestBlockHeight = block.height;
  });
}
// 1e9 limit = ~2M years from now
// Mostly for sync to set height
function bestHeight(height) {
  if (Number.isInteger(height) &&
    height > 0 &&
    height < 1 * 1e9) {
    bestBlockHeight = height;
    return bestBlockHeight;
  }
  return bestBlockHeight;
}

module.exports = {
  getBlock,
  getBlocks,
  bestHeight,
};
