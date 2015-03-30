'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

/**
 * Request peer to clear data for a bloom filter
 * @extends Message
 * @param {Number} options.magicNumber
 * @constructor
 */
function FilterclearMessage(options) {
  Message.call(this, options);
  this.magicNumber = options.magicNumber;
  this.command = 'filterclear';
}
inherits(FilterclearMessage, Message);

FilterclearMessage.prototype.setPayload = function() {};

FilterclearMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = FilterclearMessage;
