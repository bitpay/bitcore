const BlockModel = require('../../models/block');
const TxParser   = require('./transaction');
const config     = require('../../config');
const util       = require('../../lib/util');
const logger     = require('../logger');

function parse(entry, block) {
  const rawBlock  = block.toRaw().toString('hex');
  const json      = block.toJSON();
  const reward    = util.calcBlockReward(entry.height);

  const newBlock = new BlockModel({
    hash:       json.hash,
    height:     entry.height,
    version:    json.version,
    size:       block.size,
    prevBlock:  json.prevBlock,
    merkleRoot: json.merkleRoot,
    ts:         json.ts,
    bits:       json.bits,
    nonce:      json.nonce,
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
    TxParser.parse(entry, block.txs);
  });
}

module.exports = {
  parse,
};
