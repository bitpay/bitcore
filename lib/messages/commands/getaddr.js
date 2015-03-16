'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

/**
 * Request information about active peers
 * @extends Message
 * @constructor
 */
function GetaddrMessage(options) {
  if (!(this instanceof GetaddrMessage)) {
    return new GetaddrMessage(options);
  }
  if (!options) {
    options = {};
  }
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'getaddr';
}
inherits(GetaddrMessage, Message);

GetaddrMessage.fromBuffer = function() {
  return new GetaddrMessage({});
};

GetaddrMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return GetaddrMessage;
};
