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


module.exports = mongoose.model('Block', BlockSchema);