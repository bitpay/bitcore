const FullNode    = require('bcoin/lib/node/fullnode');
const logger      = require('../../lib/logger');
const config      = require('../../config');
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
    // Assemble Bcoin block data
    node.chain.db.getBlockView(block)
      .then((view) => {
        const fullBlock = block.getJSON(node.network, view, entry.height);
        // Save the block
        db.blocks.saveBcoinBlock(entry, block, (err) => {
          if (err) {
            logger.log('error',
              `Error saving block ${err}`);
          }
        });
        // Save the Txs
        db.txs.saveBcoinTransactions(entry, fullBlock.txs, (err) => {
          if (err) {
            logger.log('error',
              `Error saving txs ${err}`);
          }
        });
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
