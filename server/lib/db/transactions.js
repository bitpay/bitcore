const Transactions = require('../../models/transaction.js');
const logger       = require('../logger');
const config       = require('../../config');

// For now, blocks handles these calls.
// These will be replaced with more advanced mongo
// No optimization yet.

const MAX_TXS = config.api.max_txs;
const MAX_PAGE_TXS = config.api.max_page_txs;

// For Paging
function getTransactions(params, options, limit, cb) {
  // Do not return mongo ids
  const defaultOptions = { _id: 0 };
  // Copy over mongo options
  Object.assign(defaultOptions, options);
  // Simple sanitizing
  if (!Number.isInteger(limit)) {
    limit = 1;
  }

  if (limit > MAX_PAGE_TXS) {
    limit = MAX_PAGE_TXS;
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

// Req Change, refactor above
function getTopTransactions(cb) {
  // Do not return mongo ids
  const defaultOptions = { _id: 0 };
  // Query mongo
  Transactions.find(
    {},
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
    .limit(MAX_TXS);
}

module.exports = {
  getTransaction,
  getTransactions,
  getTopTransactions,
};
