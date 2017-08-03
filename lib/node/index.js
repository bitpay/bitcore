const FullNode = require('bcoin/lib/node/fullnode');
const config = require('../../config/config.js');
const node = new FullNode(config.bcoin);
const BlockSchema = require('../../models/block');
const logger = require('../../lib/logger');
const db = require('../../lib/db');
const util = require('../../lib/util');


function start() {
  node.open()
  .then(() => {
    node.connect().then(() => {
      node.startSync();
    });
  });

  node.chain.on('connect', (entry, block) => {
    processBlock(entry, block);
  });

  function processBlock(entry, block, cb) {
    block.hash = util.revHex(block.hash().toString('hex'))
    const b = new BlockSchema({
      hash: block.hash,
      size: block.size,
      height: block.height,
      version: block.version,
      merkleRoot: block.merkleRoot,
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

    b.save((err) => {
      if (err) {
        console.log(err.message);
      }
    });
  }
}

module.exports = {
  start,
}