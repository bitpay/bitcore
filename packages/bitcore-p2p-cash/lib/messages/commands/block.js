'use strict';

const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib-cash');
const Message = require('../message');

const $ = bitcore.util.preconditions;

/**
 * @param {Block=} arg - An instance of a Block
 * @param {Object} options
 * @param {Function} options.Block - A block constructor
 * @extends Message
 * @constructor
 */
function BlockMessage(arg, options) {
  Message.call(this, options);
  this.Block = options.Block;
  this.command = 'block';
  $.checkArgument(
    arg == null || arg instanceof this.Block,
    'An instance of Block or undefined is expected'
  );
  this.block = arg;
}
inherits(BlockMessage, Message);

BlockMessage.prototype.setPayload = function(payload) {
  this.block = this.Block.fromBuffer(payload);
};

BlockMessage.prototype.getPayload = function() {
  return this.block.toBuffer();
};

module.exports = BlockMessage;
