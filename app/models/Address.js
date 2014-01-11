'use strict';

/**
 * Module dependencies.
 */
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema
    ;

/**
 * Addr Schema
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
  inputs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionItem' //Edit: I'd put the schema. Silly me.
  }],
  output: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'TransactionItem' //Edit: I'd put the schema. Silly me.
  }],
});



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
  this.fromHash(hash, function(err, addr) {
    if (err) return cb(err);
    if (!addr) { return cb(new Error('Addr not found')); }
// TODO
//    addr.getInfo(function(err) { return cb(err,addr); } );
  });
};


module.exports = mongoose.model('Address', AddressSchema);
