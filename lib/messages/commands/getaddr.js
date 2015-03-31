'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

/**
 * Request information about active peers
 * @extends Message
 * @param {Object} options
 * @param {Number} options.magicNumber
 * @constructor
 */
function GetaddrMessage(arg, options) {
  Message.call(this, arg, options);
  this.magicNumber = options.magicNumber;
  this.command = 'getaddr';
}
inherits(GetaddrMessage, Message);

GetaddrMessage.prototype.setPayload = function() {};

GetaddrMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = GetaddrMessage;
