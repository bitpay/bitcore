'use strict';

const Message = require('../message');
const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib-doge');

const BufferUtil = bitcore.util.buffer;

/**
 * Request peer to clear data for a bloom filter
 * @extends Message
 * @constructor
 */
function FilterclearMessage(arg, options) {
  Message.call(this, options);
  this.command = 'filterclear';
}
inherits(FilterclearMessage, Message);

FilterclearMessage.prototype.setPayload = function() {};

FilterclearMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = FilterclearMessage;
