'use strict';

var _ = require('lodash');
var inherits = require('inherits');
var Transaction = require('../transaction');
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
function MultiSigInput(input, pubkeys, threshold, signatures, opts) {
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
  $.checkState(Script.buildMultisigOut(this.publicKeys, threshold).equals(this.output.script),
    'Provided public keys don\'t match to the provided output script');
  this.publicKeyIndex = {};
  _.each(this.publicKeys, function(publicKey, index) {
    self.publicKeyIndex[publicKey.toString()] = index;
  });
  this.threshold = threshold;
  // Empty array of signatures
  this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
}
inherits(MultiSigInput, Input);

MultiSigInput.prototype.toObject = function() {
  var obj = Input.prototype.toObject.apply(this, arguments);
  obj.threshold = this.threshold;
  obj.publicKeys = _.map(this.publicKeys, function(publicKey) { return publicKey.toString(); });
  obj.signatures = this._serializeSignatures();
  return obj;
};

MultiSigInput.prototype._deserializeSignatures = function(signatures) {
  return _.map(signatures, function(signature) {
    if (!signature) {
      return undefined;
    }
    return new TransactionSignature(signature);
  });
};

MultiSigInput.prototype._serializeSignatures = function() {
  return _.map(this.signatures, function(signature) {
    if (!signature) {
      return undefined;
    }
    return signature.toObject();
  });
};

MultiSigInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype, hashData, signingMethod) {
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
        signature: Sighash.sign(transaction, privateKey, sigtype, index, self.output.script, self.output.satoshisBN, undefined, signingMethod),
        sigtype: sigtype
      }));
    }
  });

  return results;
};

MultiSigInput.prototype.addSignature = function(transaction, signature, signingMethod) {
  $.checkState(!this.isFullySigned(), 'All needed signatures have already been added');
  $.checkArgument(!_.isUndefined(this.publicKeyIndex[signature.publicKey.toString()]),
    'Signature has no matching public key');
  $.checkState(this.isValidSignature(transaction, signature, signingMethod));
  this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
  this._updateScript(signingMethod);
  return this;
};

MultiSigInput.prototype._updateScript = function(signingMethod) {
  this.setScript(Script.buildMultisigIn(
    this.publicKeys,
    this.threshold,
    this._createSignatures(signingMethod)
  ));
  return this;
};

MultiSigInput.prototype._createSignatures = function(signingMethod) {
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

MultiSigInput.prototype.clearSignatures = function() {
  this.signatures = new Array(this.publicKeys.length);
  this._updateScript();
};

MultiSigInput.prototype.isFullySigned = function() {
  return this.countSignatures() === this.threshold;
};

MultiSigInput.prototype.countMissingSignatures = function() {
  return this.threshold - this.countSignatures();
};

MultiSigInput.prototype.countSignatures = function() {
  return _.reduce(this.signatures, function(sum, signature) {
    return sum + (!!signature);
  }, 0);
};

MultiSigInput.prototype.publicKeysWithoutSignature = function() {
  var self = this;
  return _.filter(this.publicKeys, function(publicKey) {
    return !(self.signatures[self.publicKeyIndex[publicKey.toString()]]);
  });
};

MultiSigInput.prototype.isValidSignature = function(transaction, signature, signingMethod) {
  // FIXME: Refactor signature so this is not necessary
  signature.signature.nhashtype = signature.sigtype;
  return Sighash.verify(
    transaction,
    signature.signature,
    signature.publicKey,
    signature.inputIndex,
    this.output.script,
    this.output.satoshisBN,
    undefined,
    signingMethod
  );
};

/**
 *
 * @param {Buffer[]} signatures
 * @param {PublicKey[]} publicKeys
 * @param {Transaction} transaction
 * @param {Integer} inputIndex
 * @param {Input} input
 * @returns {TransactionSignature[]}
 */
MultiSigInput.normalizeSignatures = function(transaction, input, inputIndex, signatures, publicKeys, signingMethod) {
  return publicKeys.map(function (pubKey) {
    var signatureMatch = null;
    signatures = signatures.filter(function (signatureBuffer) {
      if (signatureMatch) {
        return true;
      }

      var signature = new TransactionSignature({
        signature: Signature.fromTxFormat(signatureBuffer),
        publicKey: pubKey,
        prevTxId: input.prevTxId,
        outputIndex: input.outputIndex,
        inputIndex: inputIndex,
        sigtype: Signature.SIGHASH_ALL
      });

      signature.signature.nhashtype = signature.sigtype;
      var isMatch = Sighash.verify(
          transaction,
          signature.signature,
          signature.publicKey,
          signature.inputIndex,
          input.output.script,
          undefined,
          signingMethod
      );

      if (isMatch) {
        signatureMatch = signature;
        return false;
      }

      return true;
    });

    return signatureMatch ? signatureMatch : null;
  });
};

MultiSigInput.OPCODES_SIZE = 1; // 0
MultiSigInput.SIGNATURE_SIZE = 73; // size (1) + DER (<=72)

MultiSigInput.prototype._estimateSize = function() {
  return MultiSigInput.OPCODES_SIZE +
    this.threshold * MultiSigInput.SIGNATURE_SIZE;
};

module.exports = MultiSigInput;
