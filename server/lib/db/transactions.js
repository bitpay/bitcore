const Transactions = require('../../models/transaction.js');
const config       = require('../../config');
const logger       = require('../logger');

const MAX_PAGE_TXS = config.api.max_page_txs;

function getTopTransactions(cb) {
  return Transactions.last(cb);
}

function getTxById(txid, cb) {
  return Transactions.byId(txid, cb);
}

function getTxByBlock(blockHash, page, limit, cb) {
  return Transactions.byBlockHash(blockHash, cb)
    .skip(limit * page);
}

function getTxByAddress(address, page, limit, cb) {
  return Transactions.byAddress(address, cb)
    .limit(limit)
    .skip(limit * page);
}

function getTxCountByBlock(blockHash, cb) {
  return Transactions.countByBlock(blockHash, cb);
}

function getTxCountByAddress(address, cb) {
  return Transactions.countByAddress(address, cb);
}

function saveBcoinTransactions(entry, txs, cb) {
  return Transactions.saveBcoinTransactions(entry, txs, cb);
}


module.exports = {
  getTopTransactions,
  getTxById,
  getTxByBlock,
  getTxCountByBlock,
  getTxByAddress,
  getTxCountByAddress,
  saveBcoinTransactions,
};
