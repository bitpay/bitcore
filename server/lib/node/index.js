const FullNode    = require('bcoin/lib/node/fullnode');
const logger      = require('../../lib/logger');
const BlockParser = require('../parser').Block;
const TxParser    = require('../parser').Transaction;
const config      = require('../../config');
const socket      = require('../../lib/api/socket');
const db          = require('../../lib/db');

const node      = new FullNode(config.bcoin);
let doneSyncing = false;


function start(bestBlockHeight) {
  node.open()
    .then(() => {
      node.connect()
        .then(() => {
          node.chain.reset(bestBlockHeight);
          node.startSync();
        });
    });

  node.chain.on('connect', (entry, block) => {
    // Saved block acts like a journal
    BlockParser.parse(entry, block);
    TxParser.parse(entry, block.txs);
    socket.processBlock(entry, block);
    db.blocks.bestHeight(entry.height);

    node.chain.db.getBlockView(block)
      .then((view) => {
        console.log(view);
      });
  });

  node.chain.on('full', () => {
    doneSyncing = true;
  });

  node.on('error', (err) => {
    logger.log('error',
      `${err}`);
  });
}

module.exports = {
  start,
};
