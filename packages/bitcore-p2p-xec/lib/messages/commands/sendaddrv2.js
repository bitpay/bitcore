'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('@bcpros/bitcore-lib-xec');
var BufferUtil = bitcore.util.buffer;

/**
 * A message indicating that the node prefers to receive new block announcements
 * via a `headers` message rather than an `inv` (BIP130).
 * @extends Message
 * @constructor
 */
function SendAddrV2Message(arg, options) {
  Message.call(this, options);
  this.command = 'sendaddrv2';
}
inherits(SendAddrV2Message, Message);

SendAddrV2Message.prototype.setPayload = function() {};

SendAddrV2Message.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = SendAddrV2Message;
