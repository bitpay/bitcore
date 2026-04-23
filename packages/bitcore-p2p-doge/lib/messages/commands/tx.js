'use strict';

const inherits = require('util').inherits;
const bitcore = require('@bitpay-labs/bitcore-lib-doge');
const Message = require('../message');

const $ = bitcore.util.preconditions;

/**
 * @param {Transaction=} arg - An instance of Transaction
 * @param {Object} options
 * @extends Message
 * @constructor
 */
function TransactionMessage(arg, options) {
  Message.call(this, options);
  this.command = 'tx';
  this.Transaction = options.Transaction;
  $.checkArgument(
    arg == null || arg instanceof this.Transaction,
    'An instance of Transaction or undefined is expected'
  );
  this.transaction = arg;
  if (!this.transaction) {
    this.transaction = new this.Transaction();
  }
}
inherits(TransactionMessage, Message);

TransactionMessage.prototype.setPayload = function(payload) {
  if (this.Transaction.prototype.fromBuffer) {
    this.transaction = new this.Transaction().fromBuffer(payload);
  } else {
    this.transaction = this.Transaction.fromBuffer(payload);
  }
};

TransactionMessage.prototype.getPayload = function() {
  return this.transaction.toBuffer();
};

module.exports = TransactionMessage;
