const FullNode = require('bcoin/lib/node/fullnode');
const config = require(`${__dirname}/config/config.js`);
const logger = require('./lib/logger');
const Block = require('./models/block');
const Api = require('./lib/api');
const db = require('./lib/db');
const util = require('./lib/util');
const node = new FullNode(config.bcoin);

logger.log('debug',
  'Debug mode started');

(async () => {
  logger.log('debug',
    'Starting Full Node');

  await node.open();
  await node.connect();

  node.on('connect', (entry, block) => {
    block.height = entry.height;
    processBlock(block);
  });

  node.on('tx', (tx) => {
    logger.log('debug',
      '%s added to mempool.', tx.txid());
  });

  node.startSync();
})();

function processBlock(block) {
  block.hash = util.revHex(block.hash().toString('hex'));
  logger.log('debug',
    `New Block Height: ${block.height}, Hash: ${block.hash}`);

  const b = new Block({
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
    chainwork: 0,
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
      console.log(err);
    }
  });
}

Api.listen(3000, () => {
  logger.log('debug',
    'listening on port 3000');
});
