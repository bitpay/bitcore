'use strict';

/**
 * Module dependencies.
 */
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema;

var TransactionItemSchema = new Schema({
  txid: String,
  index: Number,
  addr: {
    type: String,
    index: true,
  },
  // <0 is Input >0 is Output
  value: Number,
});


// Compound index
TransactionItemSchema.index({txid: 1, index: 1, value: 1}, {unique: true, dropDups: true});


TransactionItemSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


TransactionItemSchema.statics.fromAddr = function(addr, cb) {
  this.find({
    addr: addr,
  }).exec(cb);
};

module.exports = mongoose.model('TransactionItem', TransactionItemSchema);
