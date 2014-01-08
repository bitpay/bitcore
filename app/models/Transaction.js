'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema   = mongoose.Schema,
    async    = require('async');

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


TransactionSchema.statics.fromID = function(txid, cb) {
  this.findOne({
    txid: txid,
  }).exec(cb);
};

TransactionSchema.statics.fromIDWithInfo = function(txid, cb) {
  this.fromHash(hash, function(err, tx) {
    if (err) return cb(err);

    tx.getInfo(function(err) { return cb(err,tx); } );
  });
};

TransactionSchema.statics.createFromArray = function(txs, next) {

  var that = this;

  if (!txs) return next();

//  console.log('exploding ', txs);

  async.forEach( txs,
    function(tx, callback) {
      // console.log('procesing TX %s', tx);
      that.create({ txid: tx }, function(err) {
        if (err && ! err.toString().match(/E11000/)) {
          return callback();
        }
        if (err) {

          return callback(err);
        }
        return callback();

      });
    },
    function(err) {
      if (err) return next(err);
      return next();
    }
  );
};



TransactionSchema.methods.getInfo = function (next) {

  var that = this;
  var rpc  = new RpcClient(config.bitcoind);

  rpc.getRawTransaction(this.txid, function(err, txInfo) {
    if (err) return next(err);
    that.info = txInfo.result;

    //console.log("THAT", that);
    return next(null, that.info);
  });
};




module.exports = mongoose.model('Transaction', TransactionSchema);
