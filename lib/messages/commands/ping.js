'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;

/**
 * A message to confirm that a connection is still valid.
 * @param {Object=} options
 * @param {Buffer=} options.nonce
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function PingMessage(options) {
  Message.call(this, options);
  this.command = 'ping';
  this.magicNumber = options.magicNumber;
  this.nonce = options.nonce || utils.getNonce();
}
inherits(PingMessage, Message);

PingMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);
  this.nonce = parser.read(8);

  utils.checkFinished(parser);
};

PingMessage.prototype.getPayload = function() {
  return this.nonce;
};

module.exports = PingMessage;
