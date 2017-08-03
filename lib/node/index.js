const FullNode = require('bcoin/lib/node/fullnode');
const config = require('../../config/config');
const node = new FullNode(config.bcoin);
const logger = require('../../lib/logger');
const db = require('../../lib/db');
const util = require('../../lib/util');
const BlockModel = require('../../models/block');
const TxModel = require('../../models/transaction').Transaction;

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
    processBlock(entry, block);
  });
}

function processBlock(entry, block, cb) {
  const blockHash = util.revHex(block.hash().toString('hex'));

  const newBlock = new BlockModel({
    hash: blockHash,
    size: block.size,
    height: block.height,
    version: block.version,
    merkleRoot: block.merkleRoot,
    tx: block.txs.map(tx => util.revHex(tx.hash().toString('hex'))),
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
    processTx(entry, block.txs);
  });
}

function processTx(entry, txs) {
  txs.forEach((tx) => {
    const hash = util.revHex(tx.hash().toString('hex'));

    const inputs = tx.inputs.map((input) => {
      console.log('input');
      console.log(input);
      console.log(input.toJSON());
    });

    const outputs = tx.outputs.map((output) => {
      console.log('output');
      console.log(output);
      console.log(output.toJSON());
    });

    const t = new TxModel({
      txid: hash,
      chain: config.bcoin.network,
      blockHeight: entry.height,
      blockHash: '123',
      blockTime: 0,
      blockTimeNormalized: 0,
      inputs: [],
      outputs: [],
      coinbase: false,
      fee: 0,
      inputsProcessed: false,
    });
    console.log(hash);
    t.save((err) => {
      if (err) {
      console.log(err.message);
    }
    });
  });

  // console.log(util.revHex(tx.hash().toString('hex')));
  // tx.hash = util.revHex(tx.hash().toString('hex'));
  // entry.hash = util.revHex(entry.hash().toString('hex'));
  /*

  */
}

module.exports = {
  start,
};
