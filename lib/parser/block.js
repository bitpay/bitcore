const BlockModel = require('../../models/block');
const config     = require('../../config');
const util       = require('../../lib/util');
const logger     = require('../logger');

function parse(entry, block) {
  const rawBlock  = block.toRaw().toString('hex');
  const blockJSON = block.toJSON();
  const reward    = util.calcBlockReward(entry.height);

  // Can probably use destructuring to build something nicer
  const newBlock = new BlockModel({
    hash:       blockJSON.hash,
    height:     entry.height,
    size:       block.getSize(),
    version:    blockJSON.version,
    prevBlock:  blockJSON.prevBlock,
    merkleRoot: blockJSON.merkleRoot,
    ts:         blockJSON.ts,
    bits:       blockJSON.bits,
    nonce:      blockJSON.nonce,
    txs:        block.txs.map(tx => util.revHex(tx.hash().toString('hex'))),
    chainwork:  entry.chainwork,
    reward:     reward,
    network:    config.bcoin.network,
    poolInfo:   {},
    rawBlock:   rawBlock,
  });

  newBlock.save((err) => {
    if (err) {
      logger.log('error', err.message);
    }
  });
}

module.exports = {
  parse,
};
