const mongoose = require('mongoose');
const Input = require('./input');
const Output = require('./output');
const logger = require('../lib/logger');
const config = require('../config');

const Schema = mongoose.Schema;
// These limits can be overriden higher up the stack
const MAX_TXS = config.api.max_txs;
const MAX_PAGE_TXS = config.api.max_page_txs;

const TransactionSchema = new Schema({
  hash:        { type: String, default: '' },
  witnessHash: { type: String, default: '' },
  fee:         { type: Number, default: 0 },
  rate:        { type: Number, default: 0 },
  ps:          { type: Number, default: 0 },
  height:      { type: Number, default: 0 },
  block:       { type: String, default: '' },
  index:       { type: Number, default: 0 },
  version:     { type: Number, default: 0 },
  flag:        { type: Number, default: 0 },
  lockTime:    { type: Number, default: 0 },
  inputs:      [Input.schema],
  outputs:     [Output.schema],
  size:        { type: Number, default: 0 },
  network:     { type: String, default: '' },
});

TransactionSchema.index({ hash: 1 });
TransactionSchema.index({ 'outputs.address': 1 });
TransactionSchema.index({ 'inputs.address': 1 });


TransactionSchema.statics.byId = function txById(txid, cb) {
  return this.model('Transaction').findOne(
    { hash: txid },
    cb);
};

TransactionSchema.statics.byHash = function txByHash(hash, cb) {
  return this.byId(hash, cb);
};

TransactionSchema.statics.byBlockHash = function txByBlockHash(hash, cb) {
  return this.model('Transaction').find(
    { block: hash },
    cb)
    .limit(MAX_TXS);
};

TransactionSchema.statics.byAddress = function txByAddress(address, cb) {
  return this.model('Transaction').find(
    {
      $or: [
        { 'inputs.address': address },
        { 'outputs.address': address }],
    },
    cb)
    .limit(MAX_TXS);
};

TransactionSchema.statics.countByBlock = function txByAddress(hash, cb) {
  return this.model('Transaction').count(
    { block: hash },
    cb);
};

TransactionSchema.statics.countByAddress = function txByAddress(address, cb) {
  return this.model('Transaction').count(
    {
      $or: [
        { 'inputs.address': address },
        { 'outputs.address': address }],
    },
    cb);
};

TransactionSchema.statics.last = function lastTx(cb) {
  return this.model('Transaction').find(
    {},
    cb)
    .limit(MAX_TXS)
    .sort({ height: -1 });
};

TransactionSchema.statics.getEmptyInputs = function getEmptyInputs(cb) {
  return this.model('Transaction').find({
    'inputs.prevout.hash': { $ne: '0000000000000000000000000000000000000000000000000000000000000000' },
    'inputs.value': 0,
  },
  cb);
};

TransactionSchema.statics.updateInput = function updateInput(txid, inputid, value, address) {
  return this.model('Transaction').findOneAndUpdate(
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
};

module.exports = mongoose.model('Transaction', TransactionSchema);
