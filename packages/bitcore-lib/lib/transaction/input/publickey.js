'use strict';

var inherits = require('inherits');

var $ = require('../../util/preconditions');
var BufferUtil = require('../../util/buffer');

var Input = require('./input');
var Output = require('../output');
var Sighash = require('../sighash');
var Script = require('../../script');
var Signature = require('../../crypto/signature');
var TransactionSignature = require('../signature');

/**
 * Represents a special kind of input of PayToPublicKey kind.
 * @constructor
 */
function PublicKeyInput() {
  Input.apply(this, arguments);
}
inherits(PublicKeyInput, Input);

/**
 * @param {Transaction} transaction - the transaction to be signed
 * @param {PrivateKey} privateKey - the private key with which to sign the transaction
 * @param {number} index - the index of the input in the transaction input vector
 * @param {number=} sigtype - the type of signature, defaults to Signature.SIGHASH_ALL
 * @return {Array} of objects that can be
 */
PublicKeyInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;
  var publicKey = privateKey.toPublicKey();
  if (publicKey.toString() === this.output.script.getPublicKey().toString('hex')) {
    return [new TransactionSignature({
      publicKey: publicKey,
      prevTxId: this.prevTxId,
      outputIndex: this.outputIndex,
      inputIndex: index,
      signature: Sighash.sign(transaction, privateKey, sigtype, index, this.output.script),
      sigtype: sigtype
    })];
  }
  return [];
};

/**
 * Add the provided signature
 *
 * @param {Object} signature
 * @param {PublicKey} signature.publicKey
 * @param {Signature} signature.signature
 * @param {number=} signature.sigtype
 * @return {PublicKeyInput} this, for chaining
 */
PublicKeyInput.prototype.addSignature = function(transaction, signature) {
  $.checkState(this.isValidSignature(transaction, signature), 'Signature is invalid');
  this.setScript(Script.buildPublicKeyIn(
    signature.signature.toDER(),
    signature.sigtype
  ));
  return this;
};

/**
 * Clear the input's signature
 * @return {PublicKeyHashInput} this, for chaining
 */
PublicKeyInput.prototype.clearSignatures = function() {
  this.setScript(Script.empty());
  return this;
};

/**
 * Query whether the input is signed
 * @return {boolean}
 */
PublicKeyInput.prototype.isFullySigned = function() {
  return this.script.isPublicKeyIn();
};

PublicKeyInput.SCRIPT_MAX_SIZE = 73; // sigsize (1 + 72)

PublicKeyInput.prototype._estimateSize = function() {
  return PublicKeyInput.SCRIPT_MAX_SIZE;
};

module.exports = PublicKeyInput;
