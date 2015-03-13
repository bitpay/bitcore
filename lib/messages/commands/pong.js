'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function PongMessage(options) {
  if (!(this instanceof PongMessage)) {
    return new PongMessage(options);
  }
  if(!options) {
    options = {};
  }
  Message.call(this, options);
  this.command = 'pong';
  this.magicNumber = magicNumber;
  this.nonce = options.nonce;
}
inherits(PongMessage, Message);

PongMessage.fromObject = function(obj) {
  return new PongMessage(obj);
};

PongMessage.fromBuffer = function(payload) {
  var obj = {};
  var parser = new BufferReader(payload);
  obj.nonce = parser.read(8);

  utils.checkFinished(parser);
  return PongMessage.fromObject(obj);
};

PongMessage.prototype.getPayload = function() {
  return this.nonce;
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  return PongMessage;
};
