const Transactions = require('../../models/transaction.js');
const logger       = require('../logger');
const config       = require('../../config');

const Txs = new Transactions();

// No optimization yet.
// Will be replaced with a more sophisticated api soon

const MAX_TXS = config.api.max_txs;
const MAX_PAGE_TXS = config.api.max_page_txs;

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
    .limit(MAX_PAGE_TXS)
    .skip(MAX_PAGE_TXS * page);
}

function getTxByAddress(address, page, limit, cb) {
  return Txs.byAddress(address, cb)
    .limit(MAX_PAGE_TXS)
    .skip(MAX_PAGE_TXS * page);
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
