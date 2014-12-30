'use strict';

var _ = require('lodash');

var bitcore = require('bitcore');
var Address = require('./address');
var inherits = require('util').inherits;

function Transaction() {
  bitcore.Transaction.apply(this, arguments);
}
inherits(Transaction, bitcore.Transaction);


/**
 * Get ephemeral public key from a stealth metadata output
 *
 * @param {Object} output - OP_RETURN metadata output
 * @return {PublicKey} ephemeral
 */
Transaction.getEphemeral = function(output) {
  if (!output.script.isDataOut()) {
    throw new Error('output must have an OP_RETURN script');
  }
  var data = output.script.chunks[1].buf.slice(5);
  return new bitcore.PublicKey(data);
};

/**
 * Add an input to this transaction. This is a high level interface
 * to add an input, for more control, use @{link Transaction#addInput}.
 *
 * @param {Object} utxo
 * @param {Array=} pubkeys
 * @param {number=} threshold
 */
Transaction.prototype.from = function(utxo, pubkeys, threshold) {
  // Add Stealth address suport
  // Check If Stealth -> Do somehting
  return bitcore.Transaction.prototype.from.apply(this, arguments);
};


/**
 * Add an output to the transaction.
 *
 * Beware that this resets all the signatures for inputs (in further versions,
 * SIGHASH_SINGLE or SIGHASH_NONE signatures will not be reset).
 *
 * @param {string|Address} address
 * @param {number} amount in satoshis
 * @return {Transaction} this, for chaining
 */
Transaction.prototype.to = function(address, amount) {
  if (!(address instanceof Address || Address.isValid(address))) {
    return bitcore.Transaction.prototype.to.apply(this, arguments);
  }

  address = new Address(address);
  var ephemeral = new bitcore.PrivateKey();
  var paymentAddress = address.toPaymentAddress(ephemeral);

  var metadata = bitcore.util.buffer.concat([
    new Buffer([6, 0, 0, 0, 0]),
    ephemeral.publicKey.toDER()
  ]);

  this.addData(metadata);
  this.to(paymentAddress, amount);

  return this;
};

Transaction.prototype.inspect = function() {
  return '<Stealth Transaction: ' + this.toString() + '>';
};


module.exports = Transaction;