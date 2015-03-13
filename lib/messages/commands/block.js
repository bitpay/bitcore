'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');

var Block = bitcore.Block;
var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function BlockMessage(options) {
  if (!(this instanceof BlockMessage)) {
    return new BlockMessage(options);
  }
  if(!options) {
    options = {};
  }
  Message.call(this, options);
  this.command = 'block';
  this.magicNumber = magicNumber;
  this.block = options.block;
}
inherits(BlockMessage, Message);

BlockMessage.fromObject = function(options) {
  return new BlockMessage(options);
};

BlockMessage.fromBuffer = function(payload) {
  var block = Block.fromBuffer(payload);
  return BlockMessage.fromObject({block: block});
};

BlockMessage.prototype.getPayload = function() {
  return this.block.toBuffer();
};

module.exports = function(options) {
  Block = options.Block;
  magicNumber = options.magicNumber;
  return BlockMessage;
};
