'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 */
var TransactionSchema = new Schema({
  txid: {
    type: String,
    index: true,
    unique: true,
  },
  version: Number,
  locktime: Number,
  vin: {
    type: Array,
    default: [],
  },
  vout: {
    type: Array,
    default: [],
  },
  blockhash: String,
  confirmations: Number,
  time: Number,
  blocktime: Number,
});

/**
 * Statics
 */

TransactionSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


TransactionSchema.statics.fromID = function(txid, cb) {
  this.findOne({
    txid: txid,
  }).exec(cb);
};

/*
 * virtual
 */

// ugly? new object every call?
TransactionSchema.virtual('date').get(function () {
  return new Date(this.time);
});

module.exports = mongoose.model('Transaction', TransactionSchema);
