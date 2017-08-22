const TxModel     = require('../../models/transaction');
const InputModel  = require('../../models/input');
const OutputModel = require('../../models/output');
const config      = require('../../config');
const util        = require('../../lib/util');
const logger      = require('../logger');
const db          = require('../db');

// Bleh, Bcoin pulls in blocks 20 at a time
// Crappy delay for now otherwise async saves
// could miss a tx if an input refs a block within
// the last 20 that hasn't saved.
// Aggregate stuff will replace all of this.

let counter = 0;

function parse(entry, txs) {
  counter++;
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
      // As long as this modulo is divisible by 20 we should be OK for now.
      // Closer to 20 = chattier at start and less ideal later on
      if (counter % 20 === 0) {
        findEmptyInputs();
        counter = 0;
      }
    });
  });
}

function findEmptyInputs() {
  db.txs.getEmptyInputs(
    (err, txs) => {
      if (err) {
        return logger.log('error',
          `No Empty Inputs found: ${err.err}`);
      }
      // For each tx with unmarked inputs
      return txs.forEach((inputTx) => {
        inputTx.inputs.forEach((input) => {
          const txHash = input.prevout.hash;
          const outIdx = input.prevout.index;

          return db.txs.getTxById(txHash, (err, tx) => {
            if (err) {
              return logger.log('error',
                `No Tx found: ${txHash} ${err.err}`);
            }
            return db.txs.updateInput(inputTx._id, input._id, tx.outputs[outIdx].value, tx.outputs[outIdx].address);
          });
        });
      });
    });
}

module.exports = {
  parse,
};
