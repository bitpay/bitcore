const FullNode    = require('bcoin/lib/node/fullnode');
const logger      = require('../../lib/logger');
const BlockParser = require('../parser').Block;
const TxParser    = require('../parser').Transaction;
const addrParser  = require('../parser').Address;
const config      = require('../../config');
const io          = require('../api').io;

// Reverse how sockets are working

const node = new FullNode(config.bcoin);

// Hacky move this to config
let refreshBlocks = false;
// Super Hacky but better than inline Maths.
setInterval(() => {
  refreshBlocks = true;
}, 10000); // Only refresh sockets after 5s passes

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
    TxParser.parse(entry, block.txs);
    addrParser.parse(entry, block.txs);

    if (refreshBlocks) {
      refreshBlocks = false;
      io.sockets.emit('block', {
        hash: block.toJSON().hash,
      });
    }
  });

  node.pool.on('peer', (peer) => {

  });

  node.on('error', (err) => {
    logger.log('error',
      `${err}`);
  });

  node.mempool.on('tx', (tx) => {

  });
}

module.exports = {
  start,
};
