'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

/**
 * A message in response to a version message.
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function VerackMessage(options) {
  Message.call(this, options);
  this.magicNumber = options.magicNumber;
  this.command = 'verack';
}
inherits(VerackMessage, Message);

VerackMessage.prototype.setPayload = function() {};

VerackMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = VerackMessage;
