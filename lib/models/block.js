'use strict';
var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var BlockSchema = new Schema({
  mainChain: Boolean,
  height: Number,
  hash: String,
  size: Number,
  weight: Number,
  version: Number,
  merkleRoot: String,
  time: Date,
  medianTime: Date,
  nonce: Number,
  difficulty: Number,
  chainWork: String,
  previousBlockHash: String
});


module.exports = mongoose.model('Block', BlockSchema);