const FullNode    = require('bcoin/lib/node/fullnode');
const logger      = require('../../lib/logger');
const BlockParser = require('../parser').Block;
const config      = require('../../config');
const socket      = require('../../lib/api/socket');
const db          = require('../../lib/db');

const node = new FullNode(config.bcoin);

function start() {
  node.open()
    .then(() => {
      node.connect()
        .then(() => {
          node.startSync();
        });
    });

  node.chain.on('connect', (entry, block) => {
    BlockParser.parse(entry, block);
    socket.processBlock(entry, block);
    db.blocks.bestHeight(entry.height);
  });

  node.on('error', (err) => {
    logger.log('error',
      `${err}`);
  });

  node.mempool.on('tx', (tx) => {
    socket.emitTx(tx);
  });
}

module.exports = {
  start,
};
