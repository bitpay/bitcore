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
  // >0 is Input <0 is Output
  value: Number,
});



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
