const FullNode = require('bcoin/lib/node/fullnode');
const mongoose = require('mongoose');
const config = require('./config/config.js');
const logger = require('./lib/logger');
const Block = require('./models/block');
const Server = require('./lib/server');
//const BcoinNode = require('./lib/bcoin');

mongoose.connect(config.mongodb, {
  useMongoClient: true
});

logger.log('debug',
  'Debug mode started');

const node = new FullNode(config.bcoin);

(async () => {
  await node.open();
  await node.connect();

  node.on('connect', (entry, block) => {
    block.height = entry.height;
    processBlock(block);
  });

  node.on('tx', (tx) => {
    console.log('%s added to mempool.', tx.txid());
  });

  node.startSync();
})();

function processBlock(block) {
  block.hash = revHex(block.hash().toString('hex'));
  logger.log('debug',
    `New Block Height: ${block.height}, Hash: ${block.hash}`);
  let b = new Block({
    mainChain: true,
    height: block.height,
    hash: block.hash,
    version: block.version,
    merkleRoot: block.merkleRoot,
    time: block.ts,
    timeNormalized: block.ts,
    nonce: block.nonce,
    previousBlockHash: block.prevBlock,
    transactionCount: block.txs.length,
  });
  b.save((err) => {
    if (err) {
      console.log(err);
    }
  })
}

function revHex(hexString) {
  let out = '';
  for (let i = 0; i < hexString.length; i += 2) {
    out = hexString.slice(i, i + 2) + out;
  }

  return out;
}

Server.listen(3000, function() {
  console.log('listening on port 3000');
})
