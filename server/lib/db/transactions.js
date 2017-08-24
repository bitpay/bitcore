const Transactions = require('../../models/transaction.js');
const config       = require('../../config');
const logger       = require('../logger');

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

function auditInputs() {
  getEmptyInputs(
    (err, txs) => {
      if (err) {
        return logger.log('error',
          `No Empty Inputs found: ${err.err}`);
      }
      // For each tx with unmarked inputs
      logger.log('debug',
        `Found ${txs.length} txs with inputs to update`);

      return txs.forEach((inputTx) => {
        inputTx.inputs.forEach((input) => {
          const txHash = input.prevout.hash;
          const outIdx = input.prevout.index;

          return getTxById(txHash, (error, tx) => {
            if (error || !tx) {
              return logger.log('error',
                `No Tx found: ${txHash} ${error}`);
            }
            return updateInput(inputTx._id, input._id, tx.outputs[outIdx].value, tx.outputs[outIdx].address);
          });
        });
      });
    });
}

module.exports = {
  auditInputs,
  getEmptyInputs,
  getTopTransactions,
  getTxById,
  getTxByBlock,
  getTxCountByBlock,
  getTxByAddress,
  getTxCountByAddress,
  updateInput,
};
