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
  if (nested.equals(this.output.script)) {
    this.nestedWitness = false;
    this.type = Address.PayToWitnessScriptHash;
  } else if (Script.buildScriptHashOut(nested).equals(this.output.script)) {
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
  for (let index = 0; index < this.publicKeys.length; index++) {
    const publicKey = this.publicKeys[index];
    this.publicKeyIndex[publicKey.toString()] = index;
  }
  this.threshold = threshold;
  // Empty array of signatures
  this.signatures = signatures ? this._deserializeSignatures(signatures) : new Array(this.publicKeys.length);
}
inherits(MultiSigScriptHashInput, Input);

MultiSigScriptHashInput.prototype.toObject = function() {
  var obj = Input.prototype.toObject.apply(this, arguments);
  obj.threshold = this.threshold;
  obj.publicKeys = this.publicKeys.map(function(publicKey) { return publicKey.toString(); });
  obj.signatures = this._serializeSignatures();
  return obj;
};

MultiSigScriptHashInput.prototype._deserializeSignatures = function(signatures) {
  return signatures.map(function(signature) {
    if (!signature) {
      return undefined;
    }
    return new TransactionSignature(signature);
  });
};

MultiSigScriptHashInput.prototype._serializeSignatures = function() {
  return this.signatures.map(function(signature) {
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
  var hash;
  if (this.nestedWitness || this.type === Address.PayToWitnessScriptHash) {
    var scriptCode = this.getScriptCode();
    var satoshisBuffer = this.getSatoshisBuffer();
    hash = SighashWitness.sighash(transaction, sigtype, index, scriptCode, satoshisBuffer);
  } else  {
    hash = Sighash.sighash(transaction, sigtype, index, this.redeemScript);
  }
  return hash;
};

/**
 * Get signatures for this input
 * @param {Transaction} transaction - the transaction to be signed
 * @param {PrivateKey} privateKey - the private key with which to sign the transaction
 * @param {number} index - the index of the input in the transaction input vector
 * @param {number} sigtype - the type of signature, defaults to Signature.SIGHASH_ALL
 * @param {Buffer} hashData - unused for this input type
 * @param {String} signingMethod DEPRECATED - method used to sign - 'ecdsa' or 'schnorr'
 * @param {Buffer} merkleRoot - unused for this input type
 * @return {Array<TransactionSignature>}
 */
MultiSigScriptHashInput.prototype.getSignatures = function(transaction, privateKey, index, sigtype, hashData, signingMethod, merkleRoot) {
  $.checkState(this.output instanceof Output);
  sigtype = sigtype || Signature.SIGHASH_ALL;
  signingMethod = signingMethod || 'ecdsa'; // unused. Keeping for consistency with other libs

  const results = [];
  for (const publicKey of this.publicKeys) {
    if (publicKey.toString() === privateKey.publicKey.toString()) {
      var signature;
      if (this.nestedWitness || this.type === Address.PayToWitnessScriptHash) {
        var scriptCode = this.getScriptCode();
        var satoshisBuffer = this.getSatoshisBuffer();
        signature = SighashWitness.sign(transaction, privateKey, sigtype, index, scriptCode, satoshisBuffer);
      } else  {
        signature = Sighash.sign(transaction, privateKey, sigtype, index, this.redeemScript);
      }
      results.push(new TransactionSignature({
        publicKey: privateKey.publicKey,
        prevTxId: this.prevTxId,
        outputIndex: this.outputIndex,
        inputIndex: index,
        signature: signature,
        sigtype: sigtype
      }));
    }
  }
  return results;
};

MultiSigScriptHashInput.prototype.addSignature = function(transaction, signature, signingMethod) {
  $.checkState(!this.isFullySigned(), 'All needed signatures have already been added');
  $.checkArgument(this.publicKeyIndex[signature.publicKey.toString()] != null,
                  'Signature has no matching public key');
  $.checkState(this.isValidSignature(transaction, signature, signingMethod), 'Invalid Signature!');
  this.signatures[this.publicKeyIndex[signature.publicKey.toString()]] = signature;
  this._updateScript();
  return this;
};

MultiSigScriptHashInput.prototype._updateScript = function() {
  if (this.nestedWitness || this.type === Address.PayToWitnessScriptHash) {
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
  return this.signatures
    .filter(function(signature) { return signature != null; })
    .map(function(signature) {
      return BufferUtil.concat([
        signature.signature.toDER(),
        BufferUtil.integerAsSingleByteBuffer(signature.sigtype)
      ]);
    });
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
  return this.signatures.reduce(function(sum, signature) {
    return sum + (!!signature);
  }, 0);
};

MultiSigScriptHashInput.prototype.publicKeysWithoutSignature = function() {
  return this.publicKeys.filter((publicKey) => {
    return !(this.signatures[this.publicKeyIndex[publicKey.toString()]]);
  });
};

MultiSigScriptHashInput.prototype.isValidSignature = function(transaction, signature, signingMethod) {
  signingMethod = signingMethod || 'ecdsa'; // unused. Keeping for consistency with other libs
  if (this.nestedWitness || this.type === Address.PayToWitnessScriptHash) {
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

MultiSigScriptHashInput.MAX_OPCODES_SIZE = 8; // serialized size (<=3) + 0 .. OP_PUSHDATAx N .. M OP_CHECKMULTISIG
MultiSigScriptHashInput.MAX_SIGNATURE_SIZE = 74; // size (1) + DER (<=72) + sighash (1)
MultiSigScriptHashInput.MAX_PUBKEY_SIZE = 34; // size (1) + DER (<=33)
MultiSigScriptHashInput.REDEEM_SCRIPT_SIZE = 34; // OP_0 (1) + scriptHash (1 + 32)

MultiSigScriptHashInput.prototype._estimateSize = function() {
  let result = this._getBaseSize();
  const WITNESS_DISCOUNT = 4;
  const witnessSize = MultiSigScriptHashInput.MAX_OPCODES_SIZE +
    this.threshold * MultiSigScriptHashInput.MAX_SIGNATURE_SIZE +
    this.publicKeys.length * MultiSigScriptHashInput.MAX_PUBKEY_SIZE;
  if (this.type === Address.PayToWitnessScriptHash) {
    result += witnessSize / WITNESS_DISCOUNT;
  } else if (this.nestedWitness) {
    result += witnessSize / WITNESS_DISCOUNT + MultiSigScriptHashInput.REDEEM_SCRIPT_SIZE;
  } else {
    result += witnessSize;
  }
  return result;
};

module.exports = MultiSigScriptHashInput;
