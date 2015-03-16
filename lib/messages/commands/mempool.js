'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var BufferUtil = bitcore.util.buffer;

var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

/**
 * The mempool message sends a request to a node asking for information about
 * transactions it has verified but which have not yet confirmed.
 * @see https://en.bitcoin.it/wiki/Protocol_documentation#mempool
 * @extends Message
 * @constructor
 */
function MempoolMessage(options) {
  if (!(this instanceof MempoolMessage)) {
    return new MempoolMessage(options);
  }
  if(!options) {
    options = {};
  }
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
