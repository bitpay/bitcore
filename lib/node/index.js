const FullNode    = require('bcoin/lib/node/fullnode');
const logger      = require('../../lib/logger');
const BlockParser = require('../parser').Block;
const TxParser    = require('../parser').Transaction;
const addrParser  = require('../parser').Address;
const config      = require('../../config');

const node = new FullNode(config.bcoin);
let socket;


function start() {
  node.open()
    .then(() => {
      node.connect()
        .then(() => {
          node.startSync();
        });
    });

  node.chain.on('connect', (entry, block) => {
    logger.log('debug',
      'New Block & Ledger Entry');
    BlockParser.parse(entry, block);
    TxParser.parse(entry, block.txs);
    addrParser.parse(entry, block.txs);


  });

  node.pool.on('peer', (peer) => {
    // console.log(peer);
  });

  node.on('error', (err) => {
    logger.log('error',
      `${err}`);
  });

  // node.mempool.on('tx' ...)
}

// Super Hack
function setSocket(client) {
  console.log('setting socket for node');
  //socket = client;

}

module.exports = {
  start,
  setSocket,
};
