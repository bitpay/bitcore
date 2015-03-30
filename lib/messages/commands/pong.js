'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var utils = require('../utils');
var BufferReader = bitcore.encoding.BufferReader;

/**
 * A message in response to a ping message.
 * @param {Object=} options
 * @param {Buffer=} options.nonce
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function PongMessage(options) {
  Message.call(this, options);
  this.command = 'pong';
  this.magicNumber = options.magicNumber;
  this.nonce = options.nonce;
}
inherits(PongMessage, Message);

PongMessage.prototype.setPayload = function(payload) {
  var parser = new BufferReader(payload);
  this.nonce = parser.read(8);

  utils.checkFinished(parser);
};

PongMessage.prototype.getPayload = function() {
  return this.nonce;
};

module.exports = PongMessage;
