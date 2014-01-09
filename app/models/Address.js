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
var AddressSchema = new Schema({

  // For now we keep this as short as possible
  // More fields will be propably added as we move
  // forward with the UX
  addr: {
    type: String,
    index: true,
    unique: true,
  },
  balance: Number,
  totalReceived: Number,
  totalSent: Number,
  inTransactions: [String],
});


/**
 * Validations
 */

/*
AddressSchema.path('title').validate(function(title) {
    return title.length;
},'Title cannot be blank');
*/

/**
 * Statics
 */

AddressSchema.statics.load = function(id, cb) {
  this.findOne({
    _id: id
  }).exec(cb);
};


AddressSchema.statics.fromAddr = function(hash, cb) {
  this.findOne({
    hash: hash,
  }).exec(cb);
};


AddressSchema.statics.fromAddrWithInfo = function(hash, cb) {
  this.fromHash(hash, function(err, block) {
    if (err) return cb(err);
    if (!block) { return cb(new Error('Block not found')); }

    block.getInfo(function(err) { return cb(err,block); } );
  });
};



// TODO: Can we store the rpc instance in the Block object?
AddressSchema.methods.getInfo = function (next) {

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



module.exports = mongoose.model('Address', AddressSchema);
