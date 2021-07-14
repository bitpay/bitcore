'use strict';

/* jshint maxparams:5 */

var _ = require('lodash');
var inherits = require('inherits');
var Input = require('./input');
var Output = require('../output');
var $ = require('../../util/preconditions');

var Address = require('../../address');
var Script = require('../../script');
var Signature = require('../../crypto/signature');
var Sighash = require('../sighash');
var SighashWitness = require('../sighashwitness');
var BufferWriter = require('../../encoding/bufferwriter');
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
    this.publicKeys = pubkeys;
  } else  {
    this.publicKeys = _.sortBy(pubkeys, function(publicKey) { return publicKey.toString('hex'); });
  }
  this.redeemScript = Script.buildMultisigOut(this.publicKeys, threshold, opts);
  var nested = Script.buildWitnessMultisigOutFromScript(this.redeemScript);
  if (Script.buildScriptHashOut(nested).equals(this.output.script)) {
    this.nestedWitness = true;
    this.type = Address.PayToScriptHash;
  } else if (Script.buildScriptHashOut(this.redeemScript).equals(this.output.script)) {
    this.nestedWitness = false;
    this.type = Address.PayToScriptHash;
  } else {
    throw new Error('Provided public keys don\'t hash to the provided output');
  }

  if (this.nestedWitness) {
    var scriptSig = new Script();
    scriptSig.add(nested.toBuffer());
    this.setScript(scriptSig);
  }

  this.publicKeyIndex = {};
  _.each(this.publicKeys, function(publicKey, index) {
    self.publicKeyIndex[publicKey.toString()] = index;
  });
  this.threshold = threshold;
  // Empty array of signatures
  this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
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

MultiSigScriptHashInput.prototype.getScriptCode = function() {
  var writer = new BufferWriter();
  if (!this.redeemScript.hasCodeseparators()) {
    var redeemScriptBuffer = this.redeemScript.toBuffer();
    writer.writeVarintNum(redeemScriptBuffer.length);
    writer.write(redeemScriptBuffer);
  } else {
    throw new Error('@TODO');
  }
  return writer.toBuffer();
};

MultiSigScriptHashInput.prototype.getSighash = function(transaction, privateKey, index, sigtype) {
  var self = this;
  var hash;
  if (self.nestedWitness) {
    var scriptCode = self.getScriptCode();
    var satoshisBuffer = self.getSatoshisBuffer();
    hash = SighashWitness.sighash(transaction, sigtype, index, scriptCode, satoshisBuffer);
  } else  {
    hash = Sighash.sighash(transaction, sigtype, index, self.redeemScript);
  }
  return hash;
};

MultiSigScriptHashInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;

  var self = this;
  var results = [];
  _.each(this.publicKeys, function(publicKey) {
    if (publicKey.toString() === privateKey.publicKey.toString()) {
      var signature;
      if (self.nestedWitness) {
        var scriptCode = self.getScriptCode();
        var satoshisBuffer = self.getSatoshisBuffer();
        signature = SighashWitness.sign(transaction, privateKey, sigtype, index, scriptCode, satoshisBuffer);
      } else  {
        signature = Sighash.sign(transaction, privateKey, sigtype, index, self.redeemScript);
      }
      results.push(new TransactionSignature({
        publicKey: privateKey.publicKey,
        prevTxId: self.prevTxId,
        outputIndex: self.outputIndex,
        inputIndex: index,
        signature: signature,
        sigtype: sigtype
      }));
    }
  });
  return results;
};

MultiSigScriptHashInput.prototype.addSignature = function(transaction, signature) {
  $.checkState(!this.isFullySigned(), 'All needed signatures have already been added');
  $.checkArgument(!_.isUndefined(this.publicKeyIndex[signature.publicKey.toString()]),
                  'Signature has no matching public key');
  $.checkState(this.isValidSignature(transaction, signature));
  this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
  this._updateScript();
  return this;
};

MultiSigScriptHashInput.prototype._updateScript = function() {
  if (this.nestedWitness) {
    var stack = [
      Buffer.alloc(0),
    ];
    var signatures = this._createSignatures();
    for (var i = 0; i < signatures.length; i++) {
      stack.push(signatures[i]);
    }
    stack.push(this.redeemScript.toBuffer());
    this.setWitnesses(stack);
  } else {
    var scriptSig = Script.buildP2SHMultisigIn(
      this.publicKeys,
      this.threshold,
      this._createSignatures(),
      { cachedMultisig: this.redeemScript }
    );
    this.setScript(scriptSig);
  }
  return this;
};

MultiSigScriptHashInput.prototype._createSignatures = function() {
  return _.map(
    _.filter(this.signatures, function(signature) { return !_.isUndefined(signature); }),
    function(signature) {
      return BufferUtil.concat([
        signature.signature.toDER(),
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

MultiSigScriptHashInput.prototype.isValidSignature = function(transaction, signature) {
  if (this.nestedWitness) {
    signature.signature.nhashtype = signature.sigtype;
    var scriptCode = this.getScriptCode();
    var satoshisBuffer = this.getSatoshisBuffer();
    return SighashWitness.verify(
      transaction,
      signature.signature,
      signature.publicKey,
      signature.inputIndex,
      scriptCode,
      satoshisBuffer
    );
  } else {
    // FIXME: Refactor signature so this is not necessary
    signature.signature.nhashtype = signature.sigtype;
    return Sighash.verify(
      transaction,
      signature.signature,
      signature.publicKey,
      signature.inputIndex,
      this.redeemScript
    );
  }
};

MultiSigScriptHashInput.OPCODES_SIZE = 7; // serialized size (<=3) + 0 .. N .. M OP_CHECKMULTISIG
MultiSigScriptHashInput.SIGNATURE_SIZE = 74; // size (1) + DER (<=72) + sighash (1)
MultiSigScriptHashInput.PUBKEY_SIZE = 34; // size (1) + DER (<=33)
MultiSigScriptHashInput.REDEEM_SCRIPT_SIZE = 34; // OP_0 (1) + scriptHash (1 + 32)

MultiSigScriptHashInput.prototype._estimateSize = function() {
  var WITNESS_DISCOUNT = 4;
  var witnessSize = MultiSigScriptHashInput.OPCODES_SIZE +
    this.threshold * MultiSigScriptHashInput.SIGNATURE_SIZE +
    this.publicKeys.length * MultiSigScriptHashInput.PUBKEY_SIZE;
  if (this.nestedWitness) {
    return witnessSize / WITNESS_DISCOUNT + MultiSigScriptHashInput.REDEEM_SCRIPT_SIZE;
  } else {
    return witnessSize;
  }
};

module.exports = MultiSigScriptHashInput;