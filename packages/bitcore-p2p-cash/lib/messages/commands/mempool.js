'use strict';

const Message = require('../message');
const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib-cash');

const BufferUtil = bitcore.util.buffer;

/**
 * The mempool message sends a request to a node asking for information about
 * transactions it has verified but which have not yet confirmed.
 * @see https://en.bitcoin.it/wiki/Protocol_documentation#mempool
 * @param {Object} options
 * @extends Message
 * @constructor
 */
function MempoolMessage(arg, options) {
  Message.call(this, options);
  this.command = 'mempool';
}
inherits(MempoolMessage, Message);

MempoolMessage.prototype.setPayload = function() {};

MempoolMessage.prototype.getPayload = function() {
  return BufferUtil.EMPTY_BUFFER;
};

module.exports = MempoolMessage;
