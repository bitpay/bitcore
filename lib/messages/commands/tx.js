'use strict';

var Message = require('../message');
var inherits = require('util').inherits;

/**
 * @param {Object|Transaction=} options - If is an instance of Transaction will use as options.transaction
 * @param {Transaction=} options.transaction - An instance of a Transaction
 * @param {Number} options.magicNumber
 * @extends Message
 * @constructor
 */
function TransactionMessage(options) {
  Message.call(this, options);
  this.command = 'tx';
  this.magicNumber = options.magicNumber;
  this.Transaction = options.Transaction;

  var transaction;
  if(options instanceof this.Transaction) {
    transaction = options;
  } else {
    transaction = options.transaction;
  }

  this.transaction = transaction;
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
