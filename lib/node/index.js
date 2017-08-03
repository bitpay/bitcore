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
    const txHash = util.revHex(tx.hash().toString('hex'));
    const blockHash = util.revHex(entry.hash);

    const inputs = tx.inputs.map((input) => {
      //console.log('input');
      //console.log(input);
      //console.log(input.toJSON());
    });

    const outputs = tx.outputs.map((output) => {
      //console.log('output');
      //console.log(output);
      //console.log(output.toJSON());
    });

    const t = new TxModel({
      txid: txHash,
      version: 1,
      lockTime: tx.lockTime,
      vin: [],
      vout: [],
      blockHash: blockHash,
      blockHeight: entry.height,
      confirmations: 0,
      time: entry.ts,
      blockTime: entry.ts,
      blockTimeNormalized: entry.ts,
      valueOut: tx.value,
      size: tx.size,
      valueIn: tx.value,
      fees: tx.fee,
      chain: config.bcoin.network,
    });
    console.log(txHash);
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
