'use strict';

var Message = require('../message');
var inherits = require('util').inherits;
var bitcore = require('bitcore');

var Transaction = bitcore.Transaction;
var magicNumber = bitcore.Networks.defaultNetwork.networkMagic.readUInt32LE(0);

function TransactionMessage(options) {
  Message.call(this, options);
  this.command = 'tx';
  this.magicNumber = magicNumber;
  this.transaction = options.transaction;
};
inherits(TransactionMessage, Message);

TransactionMessage.fromObject = function(options) {
  return new TransactionMessage(options);
};

TransactionMessage.fromBuffer = function(payload) {
  var transaction;
  if (Transaction.prototype.fromBuffer) {
    transaction = Transaction().fromBuffer(payload);
  } else {
    transaction = Transaction.fromBuffer(payload);
  }
  return TransactionMessage.fromObject({transaction: transaction});
};

TransactionMessage.prototype.getPayload = function() {
  return this.transaction.toBuffer();
};

module.exports = function(options) {
  magicNumber = options.magicNumber || magicNumber;
  Transaction = options.Transaction || Transaction;
  return TransactionMessage;
};
