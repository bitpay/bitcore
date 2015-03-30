'use strict';

var Message = require('../message');
var inherits = require('util').inherits;

/**
 * @param {Object|Block=} options - If is an instance of Block will use as options.block
 * @param {Block=} options.block - An instance of a Block
 * @param {Number} options.magicNumber
 * @param {Function} options.Block - A block constructor
 * @extends Message
 * @constructor
 */
function BlockMessage(options) {
  Message.call(this, options);
  this.Block = options.Block;
  this.command = 'block';
  this.magicNumber = options.magicNumber;

  var block;
  if (options instanceof this.Block) {
    block = options;
  } else {
    block = options.block;
  }

  this.block = block;
}
inherits(BlockMessage, Message);

BlockMessage.prototype.setPayload = function(payload) {
  this.block = this.Block.fromBuffer(payload);
};

BlockMessage.prototype.getPayload = function() {
  return this.block.toBuffer();
};

module.exports = BlockMessage;
