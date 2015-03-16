'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

/**
 * Request peer to clear data for a bloom filter
 * @extends Message
 * @constructor
 */
function FilterclearMessage(options) {
  if (!(this instanceof FilterclearMessage)) {
    return new FilterclearMessage(options);
  }
  if(!options) {
    options = {};
  }
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'filterclear';
}
inherits(FilterclearMessage, Message);

FilterclearMessage.fromObject = function(options) {
  return new FilterclearMessage(options);
};

FilterclearMessage.fromBuffer = function(payload) {
  return FilterclearMessage.fromObject({});
};

FilterclearMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return FilterclearMessage;
};
