'use strict';

/**
 * Module dependencies.
 */
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema;

var async       = require('async');
var Transaction = require('./Transaction');

/**
 * Block Schema
 */
var BlockSchema = new Schema({
  hash: {
    type: String,
    index: true,
    unique: true,
  },
  size: Number,
  height: Number,
  confirmations: Number,
  version: Number,
  merkleroot: String,
  tx: [ String ],
  time: Date,
  nonce: Number,
  bits: String,
  difficulty: Number,
  chainwork: String,
  previousblockhash:  {
    type: String,
    index: true,
    unique: true,
  },
  nextblockhash: {
    type: String,
    index: true,
    unique: true,
  },
});

BlockSchema.methods.explodeTransactions = function(next) {

  //  console.log('exploding %s', this.hash, typeof this.tx);

  async.forEach( this.tx,
    function(tx, callback) {
      // console.log('procesing TX %s', tx);
      Transaction.create({ txid: tx }, function(err) {
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

/**
 * Validations
 */

/*
BlockSchema.path('title').validate(function(title) {
    return title.length;
},'Title cannot be blank');
*/

/**
 * Statics
 */

BlockSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


BlockSchema.statics.fromHash = function(hash, cb) {
  this.findOne({
    hash: hash,
  }).exec(cb);
};


module.exports = mongoose.model('Block', BlockSchema);
