const Transactions = require('../../models/transaction.js');
const logger       = require('../logger');
const config       = require('../../config');

const Txs = new Transactions();
const MAX_PAGE_TXS = config.api.max_page_txs;

function getEmptyInputs(cb) {
  return Txs.getEmptyInputs(cb);
}

function getTopTransactions(cb) {
  return Txs.last(cb);
}

function getTxById(txid, cb) {
  return Txs.byId(txid, cb);
}

function getTxByBlock(blockHash, page, limit, cb) {
  return Txs.byBlockHash(blockHash, cb)
    .skip(limit * page);
}

function getTxByAddress(address, page, limit, cb) {
  return Txs.byAddress(address, cb)
    .limit(limit)
    .skip(limit * page);
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
  getEmptyInputs,
  getTopTransactions,
  getTxById,
  getTxByBlock,
  getTxCountByBlock,
  getTxByAddress,
  getTxCountByAddress,
  updateInput,
};
