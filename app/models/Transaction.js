'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema   = mongoose.Schema,
    async    = require('async'),
    RpcClient   = require('bitcore/RpcClient').class(),
    config      = require('../../config/config');
    

/**
 */
var TransactionSchema = new Schema({
  // For now we keep this as short as possible
  // More fields will be propably added as we move
  // forward with the UX
  txid: {
    type: String,
    index: true,
    unique: true,
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


TransactionSchema.statics.fromId = function(txid, cb) {
  this.findOne({
    txid: txid,
  }).exec(cb);
};

TransactionSchema.statics.fromIdWithInfo = function(txid, cb) {
  this.fromId(txid, function(err, tx) {
    if (err) return cb(err);

    tx.getInfo(function(err) { return cb(err,tx); } );
  });
};

TransactionSchema.statics.createFromArray = function(txs, next) {
  var that = this;
  if (!txs) return next();

  async.forEach( txs,
    function(tx, callback) {
      that.create({ txid: tx }, function(err) {
        if (err && ! err.toString().match(/E11000/)) {
          return callback(err);
        }
        return callback();
      });
    },
    function(err) {
      return next(err);
    }
  );
};



TransactionSchema.methods.getInfo = function (next) {

  var that = this;
  var rpc  = new RpcClient(config.bitcoind);

  rpc.getRawTransaction(this.txid, 1, function(err, txInfo) {
    if (err) return next(err);
    that.info = txInfo.result;

    //console.log("THAT", that);
    return next(null, that.info);
  });
};




module.exports = mongoose.model('Transaction', TransactionSchema);
