'use strict';

const inherits = require('inherits');

const $ = require('../../util/preconditions');
const Input = require('./input');
const Output = require('../output');
const Script = require('../../script');
const Sighash = require('../sighash');
const Signature = require('../../crypto/signature');
const TransactionSignature = require('../signature');

/**
 * @constructor
 */
function EscrowInput(input, inputPublicKeys, reclaimPublicKey, signatures) {
  Input.apply(this, arguments);
  signatures = signatures || input.signatures || [];
  this.inputPublicKeys = inputPublicKeys;
  this.reclaimPublicKey = reclaimPublicKey;
  this.redeemScript = Script.buildEscrowOut(inputPublicKeys, reclaimPublicKey);
  $.checkState(
    Script.buildScriptHashOut(this.redeemScript).equals(this.output.script),
    "Provided public keys don't hash to the provided output"
  );
  this.signatures = this._deserializeSignatures(signatures);
}
inherits(EscrowInput, Input);

EscrowInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype, hashData, signingMethod) {
  if (this.reclaimPublicKey.toString() !== privateKey.publicKey.toString()) return [];
  $.checkState(this.output instanceof Output, 'this.output is not an instance of Output');
  sigtype = sigtype || (Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID);
  const signature = new TransactionSignature({
    publicKey: privateKey.publicKey,
    prevTxId: this.prevTxId,
    outputIndex: this.outputIndex,
    inputIndex: index,
    signature: Sighash.sign(
      transaction,
      privateKey,
      sigtype,
      index,
      this.redeemScript,
      this.output.satoshisBN,
      undefined,
      signingMethod
    ),
    sigtype: sigtype
  });
  return [signature];
};

EscrowInput.prototype.addSignature = function(transaction, signature, signingMethod) {
  $.checkState(this.isValidSignature(transaction, signature, signingMethod));
  const reclaimScript = Script.buildEscrowIn(this.reclaimPublicKey, signature.signature, this.redeemScript);
  this.setScript(reclaimScript);
  this.signatures = [signature];
};

EscrowInput.prototype.isValidSignature = function(transaction, signature, signingMethod) {
  signingMethod = signingMethod || 'ecdsa';
  signature.signature.nhashtype = signature.sigtype;
  return Sighash.verify(
    transaction,
    signature.signature,
    signature.publicKey,
    signature.inputIndex,
    this.redeemScript,
    this.output.satoshisBN,
    undefined,
    signingMethod
  );
};


/**
 * Get the hash data to sign for this input
 * @param {Transaction} transaction The transaction to be signed
 * @param {PublicKey} publicKey The reclaim public key
 * @param {number} index The index of the input in the transaction input vector
 * @param {number} sigtype The type of signature, defaults to Signature.SIGHASH_ALL
 * @returns {Buffer}
 */
EscrowInput.prototype.getSighash = function(transaction, publicKey, index, sigtype) {
  if (this.reclaimPublicKey.toString() !== publicKey.toString()) return [];
  $.checkState(this.output instanceof Output, 'this.output is not an instance of Output');
  sigtype = sigtype || (Signature.SIGHASH_ALL | Signature.SIGHASH_FORKID);

  const sighash = Sighash.sighash(transaction, sigtype, index, this.redeemScript, this.output.satoshisBN, undefined);
  // sighash() returns data little endian but it must be signed big endian, hence the reverse
  return sighash.reverse();
};

EscrowInput.prototype.clearSignatures = function() {
  this.signatures = [];
};

EscrowInput.prototype.isFullySigned = function() {
  return this.signatures.length === 1;
};

EscrowInput.prototype._deserializeSignatures = function(signatures) {
  return signatures.map(signature => new TransactionSignature(signature));
};

module.exports = EscrowInput;
