'use strict';

/**
 * Module dependencies.
 */
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema,
    RpcClient   = require('bitcore/RpcClient').class(),
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

    //console.log("THAT", that);
    return next(null, that.info);
  });
};



module.exports = mongoose.model('Block', BlockSchema);
