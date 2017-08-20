const Transactions = require('../../models/transaction.js');
const logger       = require('../logger');
const config       = require('../../config');

// For now, blocks handles these calls.
// These will be replaced with more advanced mongo
// No optimization yet.
// Will be replaced with a more sophisticated api soon

const MAX_TXS = config.api.max_txs;
const MAX_PAGE_TXS = config.api.max_page_txs;

function getTransactions(params, options, limit, skip, cb) {
  // Do not return mongo ids
  const defaultOptions = {  };
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
    .sort({ height: 1 })
    .skip()
    .limit(limit);
}

function getTransaction(params, options, limit, skip, cb) {
  getTransactions(params, options, limit, skip, (err, tx) => {
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

function getTxById(txid, cb) {
  getTransaction(
    { hash: txid },
    {  },
    1,
    0,
    (err, transaction) => {
      if (err) {
        logger.log('error',
          `getTxById: ${txid} ${err.err}`);
        return cb(err);
      }
      return cb(null, transaction);
    });
}

function getTxByBlock(blockHash, page, limit, cb) {
  getTransactions(
    { block: blockHash },
    {},
    limit,
    page * limit,
    (err, tx) => {
      if (err) {
        logger.log('error',
          `getTxByBlock: ${err.err}`);
        return cb(err);
      }
      if (!tx.length > 0) {
        return cb({ err: 'Tx not found' });
      }
      return cb(null, tx);
    });
}

function getTxByAddress(address, page, limit, cb) {
  getTransactions(
    {
      $or: [
        { 'inputs.address': address },
        { 'outputs.address': address }],
    },
    {},
    limit,
    page * limit,
    (err, tx) => {
      if (err) {
        logger.log('error',
          `getTxByAddress: ${err.err}`);
        return cb(err);
      }
      if (!tx.length > 0) {
        return cb({ err: 'Tx not found' });
      }
      return cb(null, tx);
    });
}

function getTxCountByBlock(blockHash, cb) {
  Transactions.count(
    { block: blockHash },
    (err, count) => {
      if (err) {
        logger.log('error',
          `getTxCountByBlock ${err}`);
        return cb(err);
      }
      return cb(null, count);
    });
}

function getTxCountByAddress(address, cb) {
  Transactions.count(
    { $or: [
      { 'inputs.address': address },
      { 'outputs.address': address }],
    },
    (err, count) => {
      if (err) {
        logger.log('error',
          `getTxCountByAddress ${err}`);
        return cb(err);
      }
      return cb(null, count);
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
        logger.log('error',
          `updateInput: ${err}`);
      }
    },
  );
}

module.exports = {
  getTransaction,
  getTransactions,
  getTopTransactions,
  getTxById,
  getTxByBlock,
  getTxCountByBlock,
  getTxByAddress,
  getTxCountByAddress,
  updateInput,
};
