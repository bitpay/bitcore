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
  // OJO: mongoose doesnt accept camelcase for field names
  // <0 is Input >0 is Output
  value_sat: Number,
  ts: Number,
});


// Compound index
TransactionItemSchema.index({txid: 1, index: 1, value_sat: 1}, {unique: true, dropDups: true});


TransactionItemSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


TransactionItemSchema.statics.fromTxId = function(txid, cb) {
  this.find({
    txid: txid,
  }).exec(function (err,items) {

      // sort by 1) value sign 2) index
      return cb(err,items.sort(function(a,b){
          var sa= a.value_sat < 0 ? -1 : 1;
          var sb= b.value_sat < 0 ? -1 : 1;

          if (sa != sb) {
            return sa-sb;
          }
          else {
            return a.index - b.index;
          }
      }));
  });
};

module.exports = mongoose.model('TransactionItem', TransactionItemSchema);
