const TxModel     = require('../../models/transaction');
const InputModel  = require('../../models/input');
const OutputModel = require('../../models/output');
const config      = require('../../config');
const util        = require('../../lib/util');
const logger      = require('../logger');
const io          = require('../api').io;

const socketThrottle = 100;
let counter          = 0;

function parse(entry, txs) {
  txs.forEach((tx) => {
    const txJSON = tx.toJSON();

    counter++;

    if (counter % socketThrottle === 0) {

      io.sockets.emit('tx', {
        txid: txJSON.hash,
        valueOut: tx.outputs.reduce((sum, tx) => {
          tx = tx.toJSON();

          const valB = (tx.value || tx.valueOut.value || 0) / 1e8;

          console.log(valB)

          return sum + valB;
        }, 0),
      });
    }

    const t = new TxModel({
      hash:        txJSON.hash,
      witnessHash: txJSON.witnessHash,
      fee:         txJSON.fee,
      rate:        txJSON.rate,
      ps:          txJSON.ps,
      height:      entry.height,
      block:       util.revHex(entry.hash),
      ts:          entry.ts,
      date:        txJSON.date,
      index:       txJSON.index,
      version:     txJSON.version,
      flag:        txJSON.flag,
      inputs:      tx.inputs.map((input) => {
        const inputJSON = input.toJSON();
        return new InputModel({
          prevout:  inputJSON.prevout,
          script:   inputJSON.script,
          witness:  inputJSON.witness,
          sequence: inputJSON.sequence,
          address:  inputJSON.address,
        });
      }),
      outputs: tx.outputs.map((output) => {
        const outputJSON = output.toJSON();
        return new OutputModel({
          address: outputJSON.address,
          script:  outputJSON.script,
          value:   outputJSON.value,
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
