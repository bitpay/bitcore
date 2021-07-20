'use strict';

var _ = require('lodash');
var inherits = require('inherits');
var Input = require('./input');
var Output = require('../output');
var $ = require('../../util/preconditions');

var Script = require('../../script');
var Signature = require('../../crypto/signature');
var Sighash = require('../sighash');
var PublicKey = require('../../publickey');
var BufferUtil = require('../../util/buffer');
var TransactionSignature = require('../signature');

/**
 * @constructor
 */
function MultiSigScriptHashInput(input, pubkeys, threshold, signatures, opts) {
  /* jshint maxstatements:20 */
  opts = opts || {};
  Input.apply(this, arguments);
  var self = this;
  pubkeys = pubkeys || input.publicKeys;
  threshold = threshold || input.threshold;
  signatures = signatures || input.signatures;
  if (opts.noSorting) {
    this.publicKeys = pubkeys
  } else  {
    this.publicKeys = _.sortBy(pubkeys, function(publicKey) { return publicKey.toString('hex'); });
  }
  this.redeemScript = Script.buildMultisigOut(this.publicKeys, threshold, opts);
  $.checkState(Script.buildScriptHashOut(this.redeemScript).equals(this.output.script),
               'Provided public keys don\'t hash to the provided output');
  this.publicKeyIndex = {};
  _.each(this.publicKeys, function(publicKey, index) {
    self.publicKeyIndex[publicKey.toString()] = index;
  });
  this.threshold = threshold;
  // Empty array of signatures
  this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
  this.checkBitsField = new Uint8Array(this.publicKeys.length);
}
inherits(MultiSigScriptHashInput, Input);

MultiSigScriptHashInput.prototype.toObject = function() {
  var obj = Input.prototype.toObject.apply(this, arguments);
  obj.threshold = this.threshold;
  obj.publicKeys = _.map(this.publicKeys, function(publicKey) { return publicKey.toString(); });
  obj.signatures = this._serializeSignatures();
  return obj;
};

MultiSigScriptHashInput.prototype._deserializeSignatures = function(signatures) {
  return _.map(signatures, function(signature) {
    if (!signature) {
      return undefined;
    }
    return new TransactionSignature(signature);
  });
};

MultiSigScriptHashInput.prototype._serializeSignatures = function() {
  return _.map(this.signatures, function(signature) {
    if (!signature) {
      return undefined;
    }
    return signature.toObject();
  });
};

MultiSigScriptHashInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype, hashData, signingMethod) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || (Signature.SIGHASH_ALL |  Signature.SIGHASH_FORKID);

  var self = this;
  var results = [];
  _.each(this.publicKeys, function(publicKey) {
    if (publicKey.toString() === privateKey.publicKey.toString()) {
      results.push(new TransactionSignature({
        publicKey: privateKey.publicKey,
        prevTxId: self.prevTxId,
        outputIndex: self.outputIndex,
        inputIndex: index,
        signature: Sighash.sign(transaction, privateKey, sigtype, index, self.redeemScript, self.output.satoshisBN, undefined, signingMethod),
        sigtype: sigtype
      }));
    }
  });
  return results;
};

MultiSigScriptHashInput.prototype.addSignature = function(transaction, signature, signingMethod) {
  $.checkState(!this.isFullySigned(), 'All needed signatures have already been added');
  $.checkArgument(!_.isUndefined(this.publicKeyIndex[signature.publicKey.toString()]),
                  'Signature has no matching public key');
  $.checkState(this.isValidSignature(transaction, signature, signingMethod));
  this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
  this.checkBitsField[this.publicKeyIndex[signature.publicKey.toString()]] = (signature !== undefined) ? 1 : 0;
  this._updateScript(signingMethod, this.checkBitsField);
  return this;
};

MultiSigScriptHashInput.prototype._updateScript = function(signingMethod, checkBitsField) {
  this.setScript(Script.buildP2SHMultisigIn(
    this.publicKeys,
    this.threshold,
    this._createSignatures(signingMethod),
    { cachedMultisig: this.redeemScript, checkBits: checkBitsField, signingMethod }
  ));
  return this;
};

MultiSigScriptHashInput.prototype._createSignatures = function(signingMethod) {
  return _.map(
    _.filter(this.signatures, function(signature) { return !_.isUndefined(signature); }),
    function(signature) {
      return BufferUtil.concat([
        signature.signature.toDER(signingMethod),
        BufferUtil.integerAsSingleByteBuffer(signature.sigtype)
      ]);
    }
  );
};

MultiSigScriptHashInput.prototype.clearSignatures = function() {
  this.signatures = new Array(this.publicKeys.length);
  this._updateScript();
};

MultiSigScriptHashInput.prototype.isFullySigned = function() {
  return this.countSignatures() === this.threshold;
};

MultiSigScriptHashInput.prototype.countMissingSignatures = function() {
  return this.threshold - this.countSignatures();
};

MultiSigScriptHashInput.prototype.countSignatures = function() {
  return _.reduce(this.signatures, function(sum, signature) {
    return sum + (!!signature);
  }, 0);
};

MultiSigScriptHashInput.prototype.publicKeysWithoutSignature = function() {
  var self = this;
  return _.filter(this.publicKeys, function(publicKey) {
    return !(self.signatures[self.publicKeyIndex[publicKey.toString()]]);
  });
};

MultiSigScriptHashInput.prototype.isValidSignature = function(transaction, signature, signingMethod) {
  // FIXME: Refactor signature so this is not necessary
  signingMethod = signingMethod || "ecdsa";
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

MultiSigScriptHashInput.OPCODES_SIZE = 7; // serialized size (<=3) + 0 .. N .. M OP_CHECKMULTISIG
MultiSigScriptHashInput.SIGNATURE_SIZE = 74; // size (1) + DER (<=72) + sighash (1)
MultiSigScriptHashInput.PUBKEY_SIZE = 34; // size (1) + DER (<=33)

MultiSigScriptHashInput.prototype._estimateSize = function() {
  return MultiSigScriptHashInput.OPCODES_SIZE +
    this.threshold * MultiSigScriptHashInput.SIGNATURE_SIZE +
    this.publicKeys.length * MultiSigScriptHashInput.PUBKEY_SIZE;
};

module.exports = MultiSigScriptHashInput;
