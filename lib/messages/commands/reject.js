'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

// todo: add payload: https://en.bitcoin.it/wiki/Protocol_documentation#reject
function RejectMessage(options) {
  if (!(this instanceof RejectMessage)) {
    return new RejectMessage(options);
  }
  if(!options) {
    options = {};
  }
  Message.call(this, options);
  this.magicNumber = magicNumber;
  this.command = 'reject';
}
inherits(RejectMessage, Message);

RejectMessage.fromObject = function(options) {
  return new RejectMessage(options);
};

RejectMessage.fromBuffer = function(payload) {
  var obj = {};
  return RejectMessage.fromObject(obj);
};

RejectMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return RejectMessage;
};
