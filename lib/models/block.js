'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var BlockSchema = new Schema({
  mainChain: Boolean,
  height: Number,
  hash: String,
  version: Number,
  merkleRoot: String,
  time: Date,
  timeNormalized: Date,
  nonce: Number,
  previousBlockHash: String,
  transactionCount: Number
});

BlockSchema.index({ hash: 1 }, { unique: true });
BlockSchema.index({ height: 1 });
BlockSchema.index({ time: 1 });
BlockSchema.index({ timeNormalized: 1 });


module.exports = mongoose.model('Block', BlockSchema);