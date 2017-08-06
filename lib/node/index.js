const FullNode    = require('bcoin/lib/node/fullnode');
const logger      = require('../../lib/logger');
const BlockParser = require('../parser').Block;
const config      = require('../../config');

const node = new FullNode(config.bcoin);

let max = 0;

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
    if (max < entry.height) {
      max = entry.height;
    }
    console.log(max);
    BlockParser.parse(entry, block);
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
