const Transactions = require('../../models/transaction.js');
const logger       = require('../logger');
const config       = require('../../config');

const Txs = new Transactions();

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

function getEmptyInputs(cb) {
  return Txs.getEmptyInputs(cb);
}

function getTopTransactions(cb) {
  return Txs.last(cb)
    .limit(MAX_TXS);
}

function getTxById(txid, cb) {
  return Txs.byId(txid, cb);
}

function getTxByBlock(blockHash, page, limit, cb) {
  return Txs.byBlockHash(blockHash, cb)
    .limit(MAX_TXS);
}

function getTxByAddress(address, page, limit, cb) {
  return Txs.byAddress(address, cb)
    .limit(MAX_TXS);
}

function getTxCountByBlock(blockHash, cb) {
  return Txs.countByBlock(blockHash, cb);
}

function getTxCountByAddress(address, cb) {
  return Txs.countByAddress(address, cb);
}

function updateInput(txid, inputid, value, address) {
  return Txs.updateInput(txid, inputid, value, address);
}

module.exports = {
  getTransactions,
  getEmptyInputs,
  getTopTransactions,
  getTxById,
  getTxByBlock,
  getTxCountByBlock,
  getTxByAddress,
  getTxCountByAddress,
  updateInput,
};
