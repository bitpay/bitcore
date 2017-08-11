const TxModel     = require('../../models/transaction');
const InputModel  = require('../../models/input');
const OutputModel = require('../../models/output');
const config      = require('../../config');
const util        = require('../../lib/util');
const logger      = require('../logger');
const io          = require('../api').io;

const socketThrottle = 250;
let counter          = 0;

function parse(entry, txs) {
  txs.forEach((tx) => {
    const txJSON = tx.toJSON();

    counter++;

    if (counter % socketThrottle === 0) {

      counter = 0;

      io.sockets.emit('tx', {
        txid: txJSON.hash,
        valueOut: tx.outputs.reduce((sum, tx) => {
          tx = tx.toJSON();

          const valB = (tx.value || tx.valueOut.value || 0) / 1e8;

          return sum + valB;
        }, 0),
      });
    }
  });
}

module.exports = {
  parse,
};
