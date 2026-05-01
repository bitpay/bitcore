'use strict';

var inherits = require('inherits');

var $ = require('../../util/preconditions');
var BufferUtil = require('../../util/buffer');

var Hash = require('../../crypto/hash');
var Input = require('./input');
var Output = require('../output');
var Sighash = require('../sighash');
var SighashZIP243 = require('../sighashzip243');
var BufferWriter = require('../../encoding/bufferwriter');
var Script = require('../../script');
var Signature = require('../../crypto/signature');
var TransactionSignature = require('../signature');

/**
 * Represents a special kind of input of PayToPublicKeyHash kind.
 * @constructor
 */
function PublicKeyHashInput() {
  Input.apply(this, arguments);
}
inherits(PublicKeyHashInput, Input);

PublicKeyHashInput.prototype.getScriptCode = function() {
  var writer = new BufferWriter();
  var redeemScriptBuffer = this.output._scriptBuffer;
  writer.writeVarintNum(redeemScriptBuffer.length);
  writer.write(redeemScriptBuffer);
  return writer.toBuffer();
};

PublicKeyHashInput.prototype.getSighash = function(transaction, privateKey, index, sigtype) {
  var hash;
  if (transaction.version >= 4) {
    hash = SighashZIP243.sighash(transaction, sigtype, index, this.getScriptCode(), this.getSatoshisBuffer());
  } else  {
    hash = Sighash.sighash(transaction, sigtype, index, this.output.script);
  }
  return hash;
};

/* jshint maxparams: 5 */
/**
 * @param {Transaction} transaction - the transaction to be signed
 * @param {PrivateKey} privateKey - the private key with which to sign the transaction
 * @param {number} index - the index of the input in the transaction input vector
 * @param {number=} sigtype - the type of signature, defaults to Signature.SIGHASH_ALL
 * @param {Buffer=} hashData - the precalculated hash of the public key associated with the privateKey provided
 * @return {Array} of objects that can be
 */
PublicKeyHashInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype, hashData) {
  $.checkState(this.output instanceof Output);
  hashData = hashData || Hash.sha256ripemd160(privateKey.publicKey.toBuffer());
  sigtype = sigtype || Signature.SIGHASH_ALL;

  if (BufferUtil.equals(hashData, this.output.script.getPublicKeyHash())) {
    var signature;
    if (transaction.version >= 4) {
      signature = SighashZIP243.sign(transaction, privateKey, sigtype, index, this.getScriptCode(), this.getSatoshisBuffer());
    } else  {
      signature = Sighash.sign(transaction, privateKey, sigtype, index, this.output.script);
    }
    return [new TransactionSignature({
      publicKey: privateKey.publicKey,
      prevTxId: this.prevTxId,
      outputIndex: this.outputIndex,
      inputIndex: index,
      signature: signature,
      sigtype: sigtype
    })];
  }
  return [];
};
/* jshint maxparams: 3 */

/**
 * Add the provided signature
 *
 * @param {Object} signature
 * @param {PublicKey} signature.publicKey
 * @param {Signature} signature.signature
 * @param {number=} signature.sigtype
 * @return {PublicKeyHashInput} this, for chaining
 */
PublicKeyHashInput.prototype.addSignature = function(transaction, signature) {
  $.checkState(this.isValidSignature(transaction, signature), 'Signature is invalid');
  this.setScript(Script.buildPublicKeyHashIn(
    signature.publicKey,
    signature.signature.toDER(),
    signature.sigtype
  ));
  return this;
};

/**
 * Clear the input's signature
 * @return {PublicKeyHashInput} this, for chaining
 */
PublicKeyHashInput.prototype.clearSignatures = function() {
  this.setScript(Script.empty());
  return this;
};

/**
 * Query whether the input is signed
 * @return {boolean}
 */
PublicKeyHashInput.prototype.isFullySigned = function() {
  return this.script.isPublicKeyHashIn();
};

PublicKeyHashInput.prototype.isValidSignature = function(transaction, signature) {
  if (transaction.version >= 4) {
    signature.signature.nhashtype = signature.sigtype;
    return SighashZIP243.verify(
      transaction,
      signature.signature,
      signature.publicKey,
      signature.inputIndex,
      this.getScriptCode(),
      this.getSatoshisBuffer()
    );
  } else {
    // FIXME: Refactor signature so this is not necessary
    signature.signature.nhashtype = signature.sigtype;
    return Sighash.verify(
      transaction,
      signature.signature,
      signature.publicKey,
      signature.inputIndex,
      this.output.script
    );
  }
};

PublicKeyHashInput.SCRIPT_MAX_SIZE = 73 + 34; // sigsize (1 + 72) + pubkey (1 + 33)

PublicKeyHashInput.prototype._estimateSize = function() {
  return PublicKeyHashInput.SCRIPT_MAX_SIZE;
};

module.exports = PublicKeyHashInput;
