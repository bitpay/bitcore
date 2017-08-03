const FullNode = require('bcoin/lib/node/fullnode');
const config = require('../../config/config');
const node = new FullNode(config.bcoin);
const logger = require('../../lib/logger');
const db = require('../../lib/db');
const util = require('../../lib/util');
const BlockModel = require('../../models/block');
const TxModel = require('../../models/transaction');

function start() {
  node.open()
  .then(() => {
    node.connect().then(() => {
      node.startSync();
    });
  });

  node.chain.on('connect', (entry, block) => {
    processBlock(entry, block);
  });
}

function processBlock(entry, block, cb) {
  block.hash = util.revHex(block.hash().toString('hex'));
  const newBlock = new BlockModel({
    hash: block.hash,
    size: block.size,
    height: block.height,
    version: block.version,
    merkleRoot: block.merkleRoot,
    tx: block.txs.map((tx) => {
      processTx(tx);
      return util.revHex(tx.hash().toString('hex'));
    }),
    time: block.ts,
    nonce: block.nonce,
    bits: block.bits,
    difficulty: block.bits,
    chainwork: entry.chainwork,
    confirmations: 0,
    previousBlockHash: block.previousBlockHash,
    nextBlockHash: 0,
    reward: 0,
    timeNormalized: block.ts,
    isMainChain: true,
    poolInfo: Object,
    transactionCount: block.txs.length,
  });

  newBlock.save((err) => {
    if (err) {
      console.log(err.message);
    }
  });
}

function processTx(tx) {
  console.log(tx);
  const t = new Transaction({
    txid: String,
    chain: String,
    blockHeight: Number,
    blockHash: String,
    blockTime: Date,
    blockTimeNormalized: Date,
    inputs: [Input],
    outputs: [Output],
    coinbase: Boolean,
    fee: Number,
    inputsProcessed: Boolean,
    wallets: { type: [Schema.Types.ObjectId] },
  });
}

module.exports = {
  start,
};
