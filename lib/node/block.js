const BlockModel = require('../../models/block');
const TxParser   = require('./transaction');
const util       = require('../../lib/util');
const logger     = require('../logger');

function parse(entry, block) {
  const blockHash = util.revHex(block.hash().toString('hex'));
  const merkle = util.revHex(block.merkleRoot);
  const rawBlock = block.toRaw().toString('hex');

  const newBlock = new BlockModel({
    hash: blockHash,
    size: block.size,
    height: entry.height,
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
    poolInfo: {},
    transactionCount: block.txs.length,
    rawBlock: rawBlock,
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
