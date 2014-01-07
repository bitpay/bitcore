'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


/**
 */
var TransactionSchema = new Schema({
  hash: {
    type: String,
    index: true,
    unique: true,
  },
  parsed: {
    type: Boolean,
    default: false,
  },
});

/**
 * Statics
 */

TransactionSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


TransactionSchema.statics.fromHash = function(hash, cb) {
  this.findOne({
    hash: hash,
  }).exec(cb);
};

module.exports = mongoose.model('Transaction', TransactionSchema);
