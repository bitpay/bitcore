const TxModel = require('../../models/transaction').Transaction;
const InputModel = require('../../models/transaction').Input;
const OutputModel = require('../../models/transaction').Output;
const config = require('../../config');
const util = require('../../lib/util');
const logger = require('../logger');

function parse(entry, txs) {
  txs.forEach((tx) => {
    const txHash = util.revHex(tx.hash().toString('hex'));
    const blockHash = util.revHex(entry.hash);

    const t = new TxModel({
      txid: txHash,
      version: 1,
      lockTime: tx.lockTime,
      vin: tx.inputs.map((input) => {
        const inputJSON = input.toJSON();

        return new InputModel({
          utxo: inputJSON.prevout.hash,
          vout: inputJSON.prevout.index,
          address: inputJSON.address,
          amount: 0,
        });
      }),
      vout: tx.outputs.map((output) => {
        const outputJSON = output.toJSON();

        return new OutputModel({
          address: outputJSON.address,
          amount: outputJSON.value,
          vout: 0,
        });
      }),
      blockHash,
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
