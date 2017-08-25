const TxModel     = require('../../models/transaction');
const InputModel  = require('../../models/input');
const OutputModel = require('../../models/output');
const config      = require('../../config');
const util        = require('../../lib/util');
const logger      = require('../logger');
const db          = require('../db');

function parse(entry, txs) {
  txs.forEach((tx) => {
    const t = new TxModel({
      hash: tx.hash,
      witnessHash: tx.witnessHash,
      fee: tx.fee,
      rate: tx.rate,
      size: tx.size,
      ps: tx.ps,
      height: entry.height,
      block: util.revHex(entry.hash),
      ts: entry.ts,
      date: entry.tx,
      index: tx.index,
      version: tx.version,
      flag: tx.flag,
      inputs: tx.inputs.map(input => new InputModel({
        value: input.coin ? input.coin.value : 0,
        prevout: input.prevout,
        script: input.script,
        witness: input.witness,
        sequence: input.sequence,
        address: input.coin ? input.coin.address : '',
      })),
      outputs: tx.outputs.map(output => new OutputModel({
        address: output.address,
        script: output.script,
        value: output.value,
      })),
      lockTime: tx.locktime,
      chain: config.bcoin.network,
    });


    t.save((err) => {
      if (err) {
        logger.log('error', err.message);
      }
    });
  });
}

module.exports = {
  parse,
};
