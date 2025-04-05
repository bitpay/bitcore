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
function MultiSigInput(input, pubkeys, threshold, signatures) {
  Input.apply(this, arguments);
  pubkeys = pubkeys || input.publicKeys;
  threshold = threshold || input.threshold;
  signatures = signatures || input.signatures;
  this.publicKeys = _.sortBy(pubkeys, function(publicKey) { return publicKey.toString('hex'); });
  $.checkState(Script.buildMultisigOut(this.publicKeys, threshold).equals(this.output.script),
    'Provided public keys don\'t match to the provided output script');
  this.publicKeyIndex = {};
  for (let index = 0; index < this.publicKeys.length; index++) {
    const publicKey = this.publicKeys[index];
    this.publicKeyIndex[publicKey.toString()] = index;
  }
  this.threshold = threshold;
  // Empty array of signatures
  this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
}
inherits(MultiSigInput, Input);

MultiSigInput.prototype.toObject = function() {
  var obj = Input.prototype.toObject.apply(this, arguments);
  obj.threshold = this.threshold;
  obj.publicKeys = this.publicKeys.map(function(publicKey) { return publicKey.toString(); });
  obj.signatures = this._serializeSignatures();
  return obj;
};

MultiSigInput.prototype._deserializeSignatures = function(signatures) {
  return signatures.map(function(signature) {
    if (!signature) {
      return undefined;
    }
    return new TransactionSignature(signature);
  });
};

MultiSigInput.prototype._serializeSignatures = function() {
  return this.signatures.map(function(signature) {
    if (!signature) {
      return undefined;
    }
    return signature.toObject();
  });
};

MultiSigInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;

  const results = [];
  for (const publicKey of this.publicKeys) {
    if (publicKey.toString() === privateKey.publicKey.toString()) {
      results.push(new TransactionSignature({
        publicKey: privateKey.publicKey,
        prevTxId: this.prevTxId,
        outputIndex: this.outputIndex,
        inputIndex: index,
        signature: Sighash.sign(transaction, privateKey, sigtype, index, this.output.script),
        sigtype: sigtype
      }));
    }
  }

  return results;
};

MultiSigInput.prototype.addSignature = function(transaction, signature) {
  $.checkState(!this.isFullySigned(), 'All needed signatures have already been added');
  $.checkArgument(this.publicKeyIndex[signature.publicKey.toString()] != null,
    'Signature has no matching public key');
  $.checkState(this.isValidSignature(transaction, signature));
  this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
  this._updateScript();
  return this;
};

MultiSigInput.prototype._updateScript = function() {
  this.setScript(Script.buildMultisigIn(
    this.publicKeys,
    this.threshold,
    this._createSignatures()
  ));
  return this;
};

MultiSigInput.prototype._createSignatures = function() {
  return this.signatures
    .filter(function(signature) { return signature != null; })
    .map(function(signature) {
      return BufferUtil.concat([
        signature.signature.toDER(),
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
  return this.signatures.reduce(function(sum, signature) {
    return sum + (!!signature);
  }, 0);
};

MultiSigInput.prototype.publicKeysWithoutSignature = function() {
  return this.publicKeys.filter((publicKey) => {
    return !(this.signatures[this.publicKeyIndex[publicKey.toString()]]);
  });
};

MultiSigInput.prototype.isValidSignature = function(transaction, signature) {
  // FIXME: Refactor signature so this is not necessary
  signature.signature.nhashtype = signature.sigtype;
  return Sighash.verify(
    transaction,
    signature.signature,
    signature.publicKey,
    signature.inputIndex,
    this.output.script
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
MultiSigInput.normalizeSignatures = function(transaction, input, inputIndex, signatures, publicKeys) {
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
          input.output.script
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
  return this._getBaseSize() + MultiSigInput.OPCODES_SIZE +
    this.threshold * MultiSigInput.SIGNATURE_SIZE;
};

module.exports = MultiSigInput;
