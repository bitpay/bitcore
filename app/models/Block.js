'use strict';

/**
 * Module dependencies.
 */
var mongoose = require('mongoose'),
    Schema = mongoose.Schema;


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
