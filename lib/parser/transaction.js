const TxModel     = require('../../models/transaction').Transaction;
const InputModel  = require('../../models/transaction').Input;
const OutputModel = require('../../models/transaction').Output;
const config      = require('../../config');
const util        = require('../../lib/util');
const logger      = require('../logger');

function parse(entry, txs) {
  txs.forEach((tx) => {
    const txHash    = util.revHex(tx.hash().toString('hex'));
    const blockHash = util.revHex(entry.hash);
    const json = tx.toJSON();

    const t = new TxModel({
      hash:        json.hash,
      witnessHash: json.witnessHash,
      fee:         json.fee,
      rate:        json.rate,
      ps:          json.ps,
      height:      entry.height,
      block:       entry.hash,
      ts:          entry.ts,
      date:        json.date,
      index:       json.index,
      version:     json.version,
      flag:        json.flag,
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
      lockTime: json.locktime,
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
