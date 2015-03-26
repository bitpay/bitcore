'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');

var Transaction = bitcore.Transaction;
var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

/**
 * @param {Object|Transaction=} options - If is an instance of Transaction will use as options.transaction
 * @param {Transaction=} options.transaction - An instance of a Transaction
 * @extends Message
 * @constructor
 */
function TransactionMessage(options) {
  if (!(this instanceof TransactionMessage)) {
    return new TransactionMessage(options);
  }
  if(!options) {
    options = {};
  }
  Message.call(this, options);
  this.command = 'tx';
  this.magicNumber = magicNumber;

  var transaction;
  if(options instanceof Transaction) {
    transaction = options;
  } else {
    transaction = options.transaction;
  }

  this.transaction = transaction;
}
inherits(TransactionMessage, Message);

TransactionMessage.fromBuffer = function(payload) {
  var transaction;
  if (Transaction.prototype.fromBuffer) {
    transaction = new Transaction().fromBuffer(payload);
  } else {
    transaction = Transaction.fromBuffer(payload);
  }
  return new TransactionMessage({transaction: transaction});
};

TransactionMessage.prototype.getPayload = function() {
  return this.transaction.toBuffer();
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  Transaction = options.Transaction || Transaction;
  return TransactionMessage;
};
