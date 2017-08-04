const BlockModel = require('../../models/block');
const TxParser = require('./transaction');
const util = require('../../lib/util');
const logger = require('../logger');

function parse(entry, block) {
  const blockHash = util.revHex(block.hash().toString('hex'));
  const merkle = util.revHex(block.merkleRoot);

  const newBlock = new BlockModel({
    hash: blockHash,
    size: block.size,
    height: block.height,
    version: block.version,
    merkleRoot: merkle,
    tx: block.txs.map(tx => util.revHex(tx.hash().toString('hex'))),
    time: block.ts,
    nonce: block.nonce,
    bits: block.bits,
    difficulty: block.bits,
    chainwork: entry.chainwork,
    confirmations: 0,
    previousBlockHash: block.previousBlockHash,
    nextBlockHash: 0,
    reward: 0,
    timeNormalized: block.ts,
    isMainChain: true,
    poolInfo: Object,
    transactionCount: block.txs.length,
  });

  newBlock.save((err) => {
    if (err) {
      logger.log('error', err.message);
    }
    TxParser.parse(entry, block.txs);
  });
}

module.exports = {
  parse,
};
