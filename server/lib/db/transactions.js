const Transactions = require('../../models/transaction.js');
const logger       = require('../logger');
const config       = require('../../config');

const MAX_TXS = config.api.max_txs;

function getTransactions(params, options, limit, cb) {
  // Do not return mongo ids
  const defaultOptions = { _id: 0 };
  // Copy over mongo options
  Object.assign(defaultOptions, options);
  // Simple sanitizing
  if (!Number.isInteger(limit)) {
    limit = 1;
  }

  if (limit > MAX_TXS) {
    limit = MAX_TXS;
  }

  if (limit < 1) {
    limit = 1;
  }
  // Query mongo
  Transactions.find(
    params,
    defaultOptions,
    (err, txs) => {
      if (err) {
        logger.log('error',
          `getTransactions: ${err}`);
        return cb(err);
      }
      if (!txs.length > 0) {
        return cb({ err: 'Tx not found' });
      }
      return cb(null, txs);
    })
    .sort({ height: -1 })
    .limit(limit);
}

function getTransaction(params, options, limit, cb) {
  getTransactions(params, options, limit, (err, tx) => {
    if (err) {
      logger.log('error',
        `getTransaction: ${err.err}`);
      return cb(err);
    }
    if (!tx.length > 0) {
      return cb({ err: 'Tx not found' });
    }
    return cb(null, tx[0]);
  });
}

function getTxById(txid, cb) {
  getTransaction(
    { hash: txid },
    {},
    1,
    (err, transaction) => {
      if (err) {
        logger.log('err',
          `/rawblock/:blockHash: ${err}`);
        return cb(err);
      }
      return cb(null, transaction);
    });
}

function updateInput(txid, inputid, value, address) {
  Transactions.findOneAndUpdate(
    { _id: txid, 'inputs._id': inputid },
    {
      $set: {
        'inputs.$.value': value,
        'inputs.$.address': address,
      },
    },
    (err, tx) => {
      if (err) {
        logger.log('err',
          `updateInput: ${err}`);
      }
    },
  );
}

module.exports = {
  getTransaction,
  getTransactions,
  getTxById,
  updateInput,
};
