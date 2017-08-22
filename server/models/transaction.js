const mongoose = require('mongoose');
const Input = require('./input');
const Output = require('./output');
const logger = require('../lib/logger');

const Schema = mongoose.Schema;

const TransactionSchema = new Schema({
  hash: { type: String, default: '' },
  witnessHash: { type: String, default: '' },
  fee: { type: Number, default: 0 },
  rate: { type: Number, default: 0 },
  ps: { type: Number, default: 0 },
  height: { type: Number, default: 0 },
  block: { type: String, default: '' },
  index: { type: Number, default: 0 },
  version: { type: Number, default: 0 },
  flag: { type: Number, default: 0 },
  lockTime: { type: Number, default: 0 },
  inputs: [Input.schema],
  outputs: [Output.schema],
  size: { type: Number, default: 0 },
  network: { type: String, default: '' },
});

TransactionSchema.index({ hash: 1 });

TransactionSchema.methods.byId = function txById(txid, cb) {
  return this.model('Transaction').findOne(
    { hash: txid },
    (err, tx) => {
      if (err) {
        logger.log('error',
          `byId: ${err}`);
        return cb(err);
      }
      return cb(null, tx);
    });
};

TransactionSchema.methods.byHash = function txByHash(hash, cb) {
  return this.byId(hash, cb);
};

TransactionSchema.methods.byBlockHash = function txByBlockHash(hash, cb) {
  return this.model('Transaction').find(
    { block: hash },
    (err, txs) => {
      if (err) {
        logger.log('error',
          `byBlockHash: ${err}`);
        return cb(err);
      }
      return cb(null, txs);
    },
  );
};

TransactionSchema.methods.byAddress = function txByAddress(address, cb) {
  return this.model('Transaction').find(
    {
      $or: [
        { 'inputs.address': address },
        { 'outputs.address': address }],
    },
    (err, tx) => {
      if (err) {
        logger.log('error',
          `byAddress: ${err.err}`);
        return cb(err);
      }
      if (!tx.length > 0) {
        return cb({ err: 'Tx not found' });
      }
      return cb(null, tx);
    },
  );
};

TransactionSchema.methods.countByBlock = function txByAddress(hash, cb) {
  return this.model('Transaction').count(
    { block: hash },
    (err, count) => {
      if (err) {
        logger.log('error',
          `countByBlock ${err}`);
        return cb(err);
      }
      return cb(null, count);
    },
  );
};

TransactionSchema.methods.countByAddress = function txByAddress(address, cb) {
  return this.model('Transaction').count(
    {
      $or: [
        { 'inputs.address': address },
        { 'outputs.address': address }],
    },
    (err, count) => {
      if (err) {
        logger.log('error',
          `countByAddress ${err}`);
        return cb(err);
      }
      return cb(null, count);
    },
  );
};

TransactionSchema.methods.updateInput = function updateInput(txid, inputid, value, address) {
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

TransactionSchema.methods.last = function lastTx(cb) {
  return this.model('Transaction').find(
    {},
    (err, txs) => {
      if (err) {
        logger.log('error',
          `TransactionSchema last: ${err}`);
        return cb(err);
      }
      if (!txs.length > 0) {
        return cb({ err: 'Tx not found' });
      }
      return cb(null, txs);
    },
  );
};

TransactionSchema.methods.getEmptyInputs = function findEmptyInputs(cb) {
  return this.model('Transaction').find({
    'inputs.prevout.hash': { $ne: '0000000000000000000000000000000000000000000000000000000000000000' },
    'inputs.address': '',
  },
  cb);
};


module.exports = mongoose.model('Transaction', TransactionSchema);
