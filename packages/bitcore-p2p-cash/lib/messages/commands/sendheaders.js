'use strict';

const Message = require('../message');
const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib-cash');

const BufferUtil = bitcore.util.buffer;

/**
 * A message indicating that the node prefers to receive new block announcements
 * via a `headers` message rather than an `inv` (BIP130).
 * @extends Message
 * @constructor
 */
function SendHeadersMessage(arg, options) {
  Message.call(this, options);
  this.command = 'sendheaders';
}
inherits(SendHeadersMessage, Message);

SendHeadersMessage.prototype.setPayload = function() {};

SendHeadersMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = SendHeadersMessage;
