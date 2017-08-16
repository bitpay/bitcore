const Block = require('../../models/block.js');
const logger = require('../logger');
const config = require('../../config');

const MAX_BLOCKS = config.api.max_blocks; // ~ 12 hours

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

module.exports = {
  getBlock,
  getBlocks,
};
