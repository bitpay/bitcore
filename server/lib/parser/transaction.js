const TxModel     = require('../../models/transaction');
const InputModel  = require('../../models/input');
const OutputModel = require('../../models/output');
const config      = require('../../config');
const util        = require('../../lib/util');
const logger      = require('../logger');

function parse(entry, txs) {
  txs.forEach((tx) => {
    const txJSON = tx.toJSON();
    const txRAW = tx.toRaw();

    const t = new TxModel({
      hash: txJSON.hash,
      witnessHash: txJSON.witnessHash,
      fee: txJSON.fee,
      rate: txJSON.rate,
      size: txRAW.length,
      ps: txJSON.ps,
      height: entry.height,
      block: util.revHex(entry.hash),
      ts: entry.ts,
      date: txJSON.date,
      index: txJSON.index,
      version: txJSON.version,
      flag: txJSON.flag,
      inputs: tx.inputs.map((input) => {
        const inputJSON = input.toJSON();
        return new InputModel({
          prevout: inputJSON.prevout,
          script: inputJSON.script,
          witness: inputJSON.witness,
          sequence: inputJSON.sequence,
          address: inputJSON.address,
        });
      }),
      outputs: tx.outputs.map((output) => {
        const outputJSON = output.toJSON();
        return new OutputModel({
          address: outputJSON.address,
          script: outputJSON.script,
          value: outputJSON.value,
        });
      }),
      lockTime: txJSON.locktime,
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
