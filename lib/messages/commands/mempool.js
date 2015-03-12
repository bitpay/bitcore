'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function MempoolMessage(options) {
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'mempool';
}
inherits(MempoolMessage, Message);

MempoolMessage.fromObject = function(options) {
  return new MempoolMessage(options);
};

MempoolMessage.fromBuffer = function(payload) {
  return MempoolMessage.fromObject({});
};

MempoolMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return MempoolMessage;
};
