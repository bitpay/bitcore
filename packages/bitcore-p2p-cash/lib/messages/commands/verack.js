'use strict';

const Message = require('../message');
const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib-cash');

const BufferUtil = bitcore.util.buffer;

/**
 * A message in response to a version message.
 * @extends Message
 * @constructor
 */
function VerackMessage(arg, options) {
  Message.call(this, options);
  this.command = 'verack';
}
inherits(VerackMessage, Message);

VerackMessage.prototype.setPayload = function() {};

VerackMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = VerackMessage;
