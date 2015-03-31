'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');
var $ = bitcore.util.preconditions;
var _ = bitcore.deps._;

/**
 * @param {Object|Transaction=} options - If is an instance of Transaction will use as options.transaction
 * @param {Transaction=} options.transaction - An instance of a Transaction
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function TransactionMessage(arg, options) {
  Message.call(this, arg, options);
  this.command = 'tx';
  this.magicNumber = options.magicNumber;
  this.Transaction = options.Transaction;
  $.checkArgument(
    _.isUndefined(arg) || arg instanceof this.Transaction,
    'An instance of Transaction or undefined is expected'
  );
  this.transaction = arg;
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
