'use strict';

/**
 * Module dependencies.
 */
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema,
    RpcClient   = require('bitcore/RpcClient').class(),
    util        = require('bitcore/util/util'),
    BitcoreBlock= require('bitcore/Block').class(),
    TransactionOut = require('./TransactionOut'),
    config      = require('../../config/config')
    ;

/**
 * Block Schema
 */
var BlockSchema = new Schema({

  // For now we keep this as short as possible
  // More fields will be propably added as we move
  // forward with the UX
  _id: {
    type: Buffer,
    index: true,
    unique: true,
    required: true,
  },
  time: Number,
  nextBlockHash: Buffer,
  isOrphan: Boolean,
});

BlockSchema.virtual('hash').get(function () {
  return this._id;
});


BlockSchema.virtual('hash').set(function (hash) {
    this._id = hash;
});


BlockSchema.virtual('hashStr').get(function () {
  return this._id.toString('hex');
});


BlockSchema.virtual('hashStr').set(function (hashStr) {
  if (hashStr)
    this._id = new Buffer(hashStr,'hex');
  else
    this._id = null;
});



BlockSchema.virtual('nextBlockHashStr').get(function () {
  return this.nextBlockHash.toString('hex');
});

BlockSchema.virtual('nextBlockHashStr').set(function (hashStr) {
  if (hashStr)
    this.nextBlockHash = new Buffer(hashStr,'hex');
  else
    this.nextBlockHash = null;
});

/*
BlockSchema.path('title').validate(function(title) {
    return title.length;
},'Title cannot be blank');
*/

/**
 * Statics
 */

BlockSchema.statics.customCreate = function(block, cb) {
  var Self= this;

  var BlockSchema = mongoose.model('Block', BlockSchema);

  var newBlock = new Self();

  newBlock.time = block.time ? block.time : Math.round(new Date().getTime() / 1000);
  newBlock.hashStr = block.hash;
  newBlock.nextBlockHashStr =  block.nextBlockHash;

  TransactionOut.createFromArray(block.tx, function(err, inserted_txs, update_addrs) {
    if (err) return cb(err);

    newBlock.save(function(err) {
      return cb(err, newBlock, inserted_txs, update_addrs);
    });
  });
};


BlockSchema.statics.blockIndex = function(height, cb) {
  var rpc  = new RpcClient(config.bitcoind);
  var hashStr = {};
  rpc.getBlockHash(height, function(err, bh){
    if (err) return cb(err);
    hashStr.blockHash = bh.result;
    cb(null, hashStr);
  });
};

BlockSchema.statics.fromHash = function(hashStr, cb) {
  var hash = new Buffer(hashStr, 'hex');

  this.findOne({
    _id: hash,
  }).exec(cb);
};


BlockSchema.statics.fromHashWithInfo = function(hashStr, cb) {
  var That = this;

  That.fromHash(hashStr, function(err, block) {
    if (err) return cb(err);

    if (!block) {
      // No in mongo...but maybe in bitcoind... lets query it
      block = new That();

      block.hashStr = hashStr;
      block.getInfo(function(err, blockInfo) {
        if (err) return cb(err);
        if (!blockInfo) return cb();

        block.save(function(err) {
          return cb(err,block);
        });
      });
    }
    else {
      block.getInfo(function(err) {
        return cb(err,block);
      });
    }
  });
};

// TODO: Can we store the rpc instance in the Block object?
BlockSchema.methods.getInfo = function (next) {

  var self = this;
  var rpc  = new RpcClient(config.bitcoind);

  rpc.getBlock(self.hashStr, function(err, blockInfo) {
    // Not found?
    if (err && err.code === -5) return next();

    if (err) return next(err);

    /*
     * Not sure this is the right way to do it.
     * Any other way to lazy load a property in a mongoose object?
     */

    self.info = blockInfo.result;
    self.info.reward =  BitcoreBlock.getBlockValue(self.info.height) / util.COIN ;

    return next(null, self.info);
  });
};



module.exports = mongoose.model('Block', BlockSchema);
