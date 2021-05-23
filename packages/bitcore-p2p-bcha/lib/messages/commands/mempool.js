'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore-lib-cash');
var BufferUtil = bitcore.util.buffer;

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
