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

  // For now we keep this as short as possible
  // More fields will be propably added as we move
  // forward with the UX
  hash: {
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
