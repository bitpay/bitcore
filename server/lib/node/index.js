const FullNode    = require('bcoin/lib/node/fullnode');
const logger      = require('../../lib/logger');
const BlockParser = require('../parser').Block;
const TxParser    = require('../parser').Transaction;
const config      = require('../../config');
const socket      = require('../../lib/api/socket');
const db          = require('../../lib/db');

const node      = new FullNode(config.bcoin);

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
    db.blocks.bestHeight(entry.height);

    node.chain.db.getBlockView(block)
      .then((view) => {
        const fullBlock = block.getJSON(node.network, view, entry.height);
        BlockParser.parse(entry, block);
        TxParser.parse(entry, fullBlock.txs);
      });
  });

  node.chain.on('full', () => {

  });

  node.on('error', (err) => {
    logger.log('error',
      `${err}`);
  });
}

module.exports = {
  start,
};
