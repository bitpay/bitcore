'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

/**
 * A message in response to a version message.
 * @extends Message
 * @constructor
 */
function VerackMessage(options) {
  if (!(this instanceof VerackMessage)) {
    return new VerackMessage(options);
  }
  if(!options) {
    options = {};
  }
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'verack';
}
inherits(VerackMessage, Message);

VerackMessage.fromObject = function(obj) {
  return new VerackMessage(obj);
};

VerackMessage.fromBuffer = function(payload) {
  return VerackMessage.fromObject({});
};

VerackMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return VerackMessage;
};
