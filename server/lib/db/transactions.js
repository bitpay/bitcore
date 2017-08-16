const Transactions = require('../../models/transaction.js');
const logger       = require('../logger');
const config       = require('../../config');

// move to config
const MAX_TXS = 50;

function getTransactions(params, options, limit, cb) {
  const defaultOptions = { _id: 0 };

  Object.assign(defaultOptions, options);

  if (!Number.isInteger(limit)) {
    limit = 1;
  }

  if (limit > MAX_TXS) {
    limit = MAX_TXS;
  }

  if (limit < 1) {
    limit = 1;
  }

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
        `getBlock: ${err.err}`);
      return cb(err);
    }
    if (!tx.length > 0) {
      return cb({ err: 'Tx not found' });
    }
    return cb(null, tx[0]);
  });
}

module.exports = {
  getTransaction,
  getTransactions,
};
