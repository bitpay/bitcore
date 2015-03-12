'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function VerackMessage(options) {
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'verack';
};
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
