const FullNode    = require('bcoin/lib/node/fullnode');
const logger      = require('../../lib/logger');
const BlockParser = require('../parser').Block;
const TxParser    = require('../parser').Transaction;
const config      = require('../../config');

const node = new FullNode(config.bcoin);

function start() {
  node.open()
    .then(() => {
      node.connect().then(() => {
        node.startSync();
      });
    });

  node.chain.on('connect', (entry, block) => {
    logger.log('debug',
      'New Block & Ledger Entry');
    BlockParser.parse(entry, block);
    TxParser.parse(entry, block.txs);
  });

  node.on('error', (err) => {
    logger.log('error',
      `${err}`);
  });

  // node.mempool.on('tx' ...)
}

module.exports = {
  start,
};
