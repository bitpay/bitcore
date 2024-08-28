const inherits = require('inherits');
const $ = require('../../util/preconditions');
const PubKeyHashInput = require('./publickeyhash');
const SighashSchnorr = require('../sighashschnorr');
const Signature = require('../../crypto/signature');
const TransactionSignature = require('../signature');
const Output = require('../output');
const PrivateKey = require('../../privatekey');

function TaprootInput() {
  PubKeyHashInput.apply(this, arguments);
}
inherits(TaprootInput, PubKeyHashInput);

/**
 * Get signatures for this input
 * @param {Transaction} transaction - the transaction to be signed
 * @param {PrivateKey} privateKey - the private key with which to sign the transaction
 * @param {number} index - the index of the input in the transaction input vector
 * @param {number} sigtype - the type of signature, defaults to Signature.SIGHASH_ALL
 * @param {Buffer} hashData - unused for this input type
 * @param {String} signingMethod - always schnorr for taproot
 * @param {Buffer} merkleRoot - the merkle root of the taproot tree
 * @return {Array<TransactionSignature>}
 */
TaprootInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype, hashData, signingMethod, merkleRoot) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_DEFAULT;
  
  const inputIndex = transaction.inputs.indexOf(this);
  const tweakedPk = privateKey.createTapTweak(merkleRoot).tweakedPrivKey;
  const signature = SighashSchnorr.sign(
    transaction,
    tweakedPk,
    sigtype,
    inputIndex,
    Signature.Version.TAPROOT,
    null
  );
  if (!signature) {
    return [];
  }
  const txSig = new TransactionSignature({
    publicKey: privateKey.publicKey,
    prevTxId: this.prevTxId,
    outputIndex: this.outputIndex,
    inputIndex,
    signature: Signature.fromSchnorr(signature),
    sigtype: sigtype
  });
  return this.isValidSignature(transaction, txSig) ? [txSig] : [];
};


TaprootInput.prototype.isValidSignature = function(transaction, signature) {
  $.checkState(transaction.inputs.indexOf(this) >= 0, 'Signature has no matching input');
  $.checkState(this.output instanceof Output, 'output is not instance of Output');
  
  if (!this.output.script.isTaproot()) {
    return false;
  }

  return SighashSchnorr.verify(
    transaction,
    signature.signature,
    this.output.script.chunks[1].buf,
    Signature.Version.TAPROOT,
    transaction.inputs.indexOf(this),
    null
  );
};

/**
 * Query whether the input is signed
 * @return {boolean}
 */
TaprootInput.prototype.isFullySigned = function() {
  return this.output.script.isTaproot() && this.hasWitnesses();
};

/**
 * Add the provided signature
 *
 * @param {Transaction} transaction
 * @param {Object} signature
 * @param {PublicKey} signature.publicKey
 * @param {Signature} signature.signature
 * @param {number} signature.sigtype
 * @return {TaprootInput} this, for chaining
 */
TaprootInput.prototype.addSignature = function(transaction, signature) {
  if (this.isValidSignature(transaction, signature)) {
    this.setWitnesses([
      signature.signature.toBuffer(),
    ]);
  }
  // else... do nothing?
  // When tx.sign(keys) is called, the given keys are used to try to sign all
  // inputs. Invalid sigs may be created, in which case we should not add them here.
  // The flow is kind of weird since this fn name is saying to add the signature.
  // Maybe the validation check should be upstream to keep the code lexically obedient?

  return this;
};


// TODO verify that this is the correct MAX size.
TaprootInput.SCRIPT_MAX_SIZE = 66; // numwitnesses (1) + sigsize (1 + 64)

TaprootInput.prototype._estimateSize = function() {
  let result = this._getBaseSize();
  result += 1; // script size
  const WITNESS_DISCOUNT = 4;
  const witnessSize = TaprootInput.SCRIPT_MAX_SIZE / WITNESS_DISCOUNT;
  result += witnessSize;
  return result;
};


module.exports = TaprootInput;
