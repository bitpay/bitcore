'use strict';

/**
 * Module dependencies.
 */
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema,
    RpcClient   = require('bitcore/RpcClient').class(),
    util        = require('bitcore/util/util'),
    BitcoreBlock= require('bitcore/Block').class(),
    Transaction = require('./Transaction'),
    config      = require('../../config/config')
    ;

/**
 * Block Schema
 */
var BlockSchema = new Schema({

  // For now we keep this as short as possible
  // More fields will be propably added as we move
  // forward with the UX
  hash: {
    type: String,
    index: true,
    unique: true,
  },
  time: Number,
  nextBlockHash: String,
});

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

BlockSchema.statics.customCreate = function(block, cb) {

  var That= this;

  var BlockSchema = mongoose.model('Block', BlockSchema);

  var newBlock = new That();

  newBlock.time = block.time ? block.time : Math.round(new Date().getTime() / 1000);
  newBlock.hash = block.hash;
  newBlock.nextBlockHash = block.nextBlockHash;


  Transaction.createFromArray(block.tx, newBlock.time, function(err, inserted_txs) {
    if (err) return cb(err);

    newBlock.save(function(err) {
      return cb(err, newBlock, inserted_txs);
    });
  });
};

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


BlockSchema.statics.fromHashWithInfo = function(hash, cb) {
  this.fromHash(hash, function(err, block) {
    if (err) return cb(err);
    if (!block) { return cb(new Error('Block not found')); }

    block.getInfo(function(err) { return cb(err,block); } );
  });
};



// TODO: Can we store the rpc instance in the Block object?
BlockSchema.methods.getInfo = function (next) {

  var that = this;
  var rpc  = new RpcClient(config.bitcoind);

  rpc.getBlock(this.hash, function(err, blockInfo) {
    if (err) return next(err);

    /*
     * Not sure this is the right way to do it.
     * Any other way to lazy load a property in a mongoose object?
     */

    that.info = blockInfo.result;

    that.info.reward =  BitcoreBlock.getBlockValue(that.info.height) / util.COIN ;

    //console.log("THAT", that);
    return next(null, that.info);
  });
};



module.exports = mongoose.model('Block', BlockSchema);
