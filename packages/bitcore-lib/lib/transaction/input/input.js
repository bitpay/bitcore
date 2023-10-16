'use strict';

var _ = require('lodash');
var $ = require('../../util/preconditions');
const errors = require('../../errors');
var BufferWriter = require('../../encoding/bufferwriter');
var buffer = require('buffer');
var BufferUtil = require('../../util/buffer');
var JSUtil = require('../../util/js');
var Script = require('../../script');
var Sighash = require('../sighash');
var SighashWitness = require('../sighashwitness');
var Output = require('../output');
const TransactionSignature = require('../signature');
const Signature = require('../../crypto/signature');
const PublicKey = require('../../publickey');
const OpCode = require('../../opcode');
const BN = require('../../crypto/bn');

var MAXINT = 0xffffffff; // Math.pow(2, 32) - 1;
var DEFAULT_SEQNUMBER = MAXINT;
var DEFAULT_LOCKTIME_SEQNUMBER = MAXINT - 1;
var DEFAULT_RBF_SEQNUMBER = MAXINT - 2;
const SEQUENCE_LOCKTIME_DISABLE_FLAG =  Math.pow(2,31); // (1 << 31);
const SEQUENCE_LOCKTIME_TYPE_FLAG = Math.pow(2,22); // (1 << 22);
const SEQUENCE_LOCKTIME_MASK = 0xffff;
const SEQUENCE_LOCKTIME_GRANULARITY = 512; // 512 seconds
const SEQUENCE_BLOCKDIFF_LIMIT = Math.pow(2,16)-1; // 16 bits 


function Input(params) {
  if (!(this instanceof Input)) {
    return new Input(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

Input.MAXINT = MAXINT;
Input.DEFAULT_SEQNUMBER = DEFAULT_SEQNUMBER;
Input.DEFAULT_LOCKTIME_SEQNUMBER = DEFAULT_LOCKTIME_SEQNUMBER;
Input.DEFAULT_RBF_SEQNUMBER = DEFAULT_RBF_SEQNUMBER;
Input.SEQUENCE_LOCKTIME_TYPE_FLAG = SEQUENCE_LOCKTIME_TYPE_FLAG;

Object.defineProperty(Input.prototype, 'script', {
  configurable: false,
  enumerable: true,
  get: function() {
    if (this.isNull()) {
      return null;
    }
    if (!this._script) {
      this._script = new Script(this._scriptBuffer);
      this._script._isInput = true;
    }
    return this._script;
  }
});

Input.fromObject = function(obj) {
  $.checkArgument(_.isObject(obj));
  var input = new Input();
  return input._fromObject(obj);
};

Input.prototype._fromObject = function(params) {
  var prevTxId;
  if (_.isString(params.prevTxId) && JSUtil.isHexa(params.prevTxId)) {
    prevTxId = Buffer.from(params.prevTxId, 'hex');
  } else {
    prevTxId = params.prevTxId;
  }
  this.witnesses = [];
  this.output = params.output ?
    (params.output instanceof Output ? params.output : new Output(params.output)) : undefined;
  this.prevTxId = prevTxId || params.txidbuf;
  this.outputIndex = _.isUndefined(params.outputIndex) ? params.txoutnum : params.outputIndex;
  this.sequenceNumber = _.isUndefined(params.sequenceNumber) ?
    (_.isUndefined(params.seqnum) ? DEFAULT_SEQNUMBER : params.seqnum) : params.sequenceNumber;
  if (_.isUndefined(params.script) && _.isUndefined(params.scriptBuffer)) {
    throw new errors.Transaction.Input.MissingScript();
  }
  this.setScript(params.scriptBuffer || params.script);
  return this;
};

Input.prototype.toObject = Input.prototype.toJSON = function toObject() {
  var obj = {
    prevTxId: this.prevTxId.toString('hex'),
    outputIndex: this.outputIndex,
    sequenceNumber: this.sequenceNumber,
    script: this._scriptBuffer.toString('hex'),
  };
  // add human readable form if input contains valid script
  if (this.script) {
    obj.scriptString = this.script.toString();
  }
  if (this.output) {
    obj.output = this.output.toObject();
  }
  return obj;
};

Input.fromBufferReader = function(br) {
  var input = new Input();
  input.prevTxId = br.readReverse(32);
  input.outputIndex = br.readUInt32LE();
  input._scriptBuffer = br.readVarLengthBuffer();
  input.sequenceNumber = br.readUInt32LE();
  // TODO: return different classes according to which input it is
  // e.g: CoinbaseInput, PublicKeyHashInput, MultiSigScriptHashInput, etc.
  return input;
};

Input.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeReverse(this.prevTxId);
  writer.writeUInt32LE(this.outputIndex);
  var script = this._scriptBuffer;
  writer.writeVarintNum(script.length);
  writer.write(script);
  writer.writeUInt32LE(this.sequenceNumber);
  return writer;
};

Input.prototype.setScript = function(script) {
  this._script = null;
  if (script instanceof Script) {
    this._script = script;
    this._script._isInput = true;
    this._scriptBuffer = script.toBuffer();
  } else if (JSUtil.isHexa(script)) {
    // hex string script
    this._scriptBuffer = Buffer.from(script, 'hex');
  } else if (_.isString(script)) {
    // human readable string script
    this._script = new Script(script);
    this._script._isInput = true;
    this._scriptBuffer = this._script.toBuffer();
  } else if (BufferUtil.isBuffer(script)) {
    // buffer script
    this._scriptBuffer = Buffer.from(script);
  } else {
    throw new TypeError('Invalid argument type: script');
  }
  return this;
};

/**
 * Retrieve signatures for the provided PrivateKey.
 *
 * @param {Transaction} transaction - the transaction to be signed
 * @param {PrivateKey} privateKey - the private key to use when signing
 * @param {number} inputIndex - the index of this input in the provided transaction
 * @param {number} sigType - defaults to Signature.SIGHASH_ALL
 * @param {Buffer} addressHash - if provided, don't calculate the hash of the
 *     public key associated with the private key provided
 * @abstract
 */
Input.prototype.getSignatures = function() {
  throw new errors.AbstractMethodInvoked(
    'Trying to sign unsupported output type (only P2PKH and P2SH multisig inputs are supported)' +
    ' for input: ' + JSON.stringify(this)
  );
};

/**
 * 
 * @param {Transaction} transaction
 * @param {number} inputIndex The index of the input in the transaction
 * @param {Script|Buffer|string} scriptPubKey (optional) required for PublicKeyIn or MultisigIn input that does not have the output attached to it.
 * @param {number|BN} satoshis (optional) required for PayToWitnessScriptHash input
 * @returns {Array<TransactionSignature>}
 */
Input.prototype.extractSignatures = function(transaction, inputIndex, scriptPubKey, satoshis) {
  $.checkArgument(JSUtil.isNaturalNumber(inputIndex), 'inputIndex is not a natural number');
  $.checkState(this.script, 'Missing input script');

  if (this.script.isPublicKeyIn()) {
    const sig = Signature.fromTxFormat(this.script.chunks[0].buf);
    if (!this.output) {
      $.checkArgument(scriptPubKey, 'scriptPubKey is required when the input is not a full UTXO');
      this.output = { script: new Script(scriptPubKey) };
    }
    const publicKey = this.output.script.chunks[0] && this.output.script.chunks[0].buf;
    $.checkArgument(publicKey, 'No public key found from UTXO scriptPubKey');
    return [new TransactionSignature({
      signature: sig,
      publicKey: new PublicKey(publicKey),
      sigtype: sig.nhashtype,
      inputIndex,
      prevTxId: this.prevTxId,
      outputIndex: this.outputIndex
    })];
  } else if (this.script.isPublicKeyHashIn()) {
    const sig = Signature.fromTxFormat(this.script.chunks[0].buf);
    return [new TransactionSignature({
      signature: sig,
      publicKey: this.script.chunks[1].buf,
      sigtype: sig.nhashtype,
      inputIndex,
      prevTxId: this.prevTxId,
      outputIndex: this.outputIndex
    })];
  } else if (this.hasWitnesses()) {
    const witnessSigs = [];
    const lastWitness = Script.fromBuffer(this.witnesses[this.witnesses.length - 1]);
    if (lastWitness.toBuffer().length > 72 && lastWitness.chunks.at(-1).opcodenum === OpCode.OP_CHECKMULTISIG) {
      // multisig
      $.checkArgument((this.output && this.output._satoshisBN) || satoshis, 'Missing required satoshis parameter');
      const satoshisBuffer = new BufferWriter().writeUInt64LEBN(this.output ? this.output._satoshisBN :new BN(satoshis)).toBuffer();
      const scriptCode = new BufferWriter().writeVarintNum(lastWitness.toBuffer().length).write(lastWitness.toBuffer()).concat();
      const numKeys = parseInt(OpCode(lastWitness.chunks.at(-2).opcodenum).toString().replace('OP_', ''));
      const publicKeys = lastWitness.chunks.slice(-2 - numKeys, -2).map(c => c.buf);
      for (const sigBuf of this.witnesses.slice(1, -1)) {
        const sig = Signature.fromTxFormat(sigBuf);
        let pkFound = false;
        for (const pk of publicKeys) {
          const txSig = new TransactionSignature({
            signature: sig,
            publicKey: pk,
            sigtype: sig.nhashtype,
            inputIndex,
            prevTxId: this.prevTxId,
            outputIndex: this.outputIndex
          });
          if (this.isValidSignature(transaction, txSig, 'ecdsa', { scriptCode, satoshisBuffer })) {
            witnessSigs.push(txSig);
            pkFound = true;
            break;
          }
        }
        $.checkState(pkFound, 'No public key found for multisig signature');
      }
    } else {
      for (let i = 0; i < this.witnesses.length; i = i + 2) {
        const sig = Signature.fromTxFormat(this.witnesses[i]);
        witnessSigs.push(new TransactionSignature({
          signature: sig,
          publicKey: this.witnesses[i+1],
          sigtype: sig.nhashtype,
          inputIndex,
          prevTxId: this.prevTxId,
          outputIndex: this.outputIndex
        }));
      }
    }
    return witnessSigs;
  } else if (this.script.isMultisigIn()) {
    $.checkArgument(transaction, 'Missing transaction parameter');
    if (!this.output) {
      $.checkArgument(scriptPubKey, 'scriptPubKey is required when the input is not a full UTXO');
      this.output = { script: new Script(scriptPubKey) };
    }
    const publicKeys = this.output.script.chunks.filter(c => c.opcodenum === 33).map(c => c.buf);
    $.checkArgument(publicKeys.length > 0, 'No public keys found from UTXO scriptPubKey');
    const sigs = [];
    for (const chunk of this.script.chunks.slice(1)) {
      const sig = Signature.fromTxFormat(chunk.buf);
      let pkFound = false;
      for (const pk of publicKeys) {
        const txSig = new TransactionSignature({
          signature: sig,
          publicKey: pk,
          sigtype: sig.nhashtype,
          inputIndex,
          prevTxId: this.prevTxId,
          outputIndex: this.outputIndex
        });
        if (this.isValidSignature(transaction, txSig, 'ecdsa')) {
          sigs.push(txSig);
          pkFound = true;
          break;
        }
      }
      $.checkState(pkFound, 'No public key found for multisig signature');
    }
    return sigs;
  } else if (this.script.isScriptHashIn()) {
    $.checkArgument(transaction, 'Missing transaction parameter');
    const redeemScript = Script.fromBuffer(this.script.chunks[this.script.chunks.length - 1].buf);
    if (!this.output) { // if this is a generic Input
      this.output = { script: redeemScript };
    }
    const publicKeys = redeemScript.chunks.filter(c => c.opcodenum === 33).map(c => c.buf);
    const sigs = [];
    for (const chunk of this.script.chunks.slice(1, -1)) {
      const sig = Signature.fromTxFormat(chunk.buf);
      let pkFound = false;
      for (const pk of publicKeys) {
        const txSig = new TransactionSignature({
          signature: sig,
          publicKey: pk,
          sigtype: sig.nhashtype,
          inputIndex,
          prevTxId: this.prevTxId,
          outputIndex: this.outputIndex
        });
        if (this.isValidSignature(transaction, txSig, 'ecdsa')) {
          sigs.push(txSig);
          pkFound = true;
          break;
        }
      }
      $.checkState(pkFound, 'No public key found for multisig signature');
    }
    return sigs;

  }

  // Unsigned input
  return [];
};

Input.prototype.getSatoshisBuffer = function() {
  $.checkState(this.output instanceof Output);
  $.checkState(this.output._satoshisBN);
  return new BufferWriter().writeUInt64LEBN(this.output._satoshisBN).toBuffer();
};


Input.prototype.isFullySigned = function() {
  throw new errors.AbstractMethodInvoked('Input#isFullySigned');
};

Input.prototype.isFinal = function() {
  return this.sequenceNumber !== Input.MAXINT;
};

Input.prototype.addSignature = function() {
  throw new errors.AbstractMethodInvoked('Input#addSignature');
};

Input.prototype.clearSignatures = function() {
  throw new errors.AbstractMethodInvoked('Input#clearSignatures');
};

Input.prototype.hasWitnesses = function() {
  if (this.witnesses && this.witnesses.length > 0) {
    return true;
  }
  return false;
};

Input.prototype.getWitnesses = function() {
  return this.witnesses;
};

Input.prototype.setWitnesses = function(witnesses) {
  this.witnesses = witnesses;
};

Input.prototype.isValidSignature = function(transaction, signature, signingMethod, witnessScriptHash) {
  // FIXME: Refactor signature so this is not necessary
  signingMethod = signingMethod || 'ecdsa';
  signature.signature.nhashtype = signature.sigtype;
  if (witnessScriptHash) {
    return SighashWitness.verify(
      transaction,
      signature.signature,
      signature.publicKey,
      signature.inputIndex,
      witnessScriptHash.scriptCode,
      witnessScriptHash.satoshisBuffer,
      signingMethod
    );
  } else {
    return Sighash.verify(
      transaction,
      signature.signature,
      signature.publicKey,
      signature.inputIndex,
      this.output.script,
      signingMethod
    );
  }
};

/**
 * @returns true if this is a coinbase input (represents no input)
 */
Input.prototype.isNull = function() {
  return this.prevTxId.toString('hex') === '0000000000000000000000000000000000000000000000000000000000000000' &&
    this.outputIndex === 0xffffffff;
};

Input.prototype._estimateSize = function() {
  return this.toBufferWriter().toBuffer().length;
};


/**
 * Sets sequence number so that transaction is not valid until the desired seconds
 *  since the transaction is mined
 *
 * @param {Number} time in seconds
 * @return {Transaction} this
 */
Input.prototype.lockForSeconds = function(seconds) {
  $.checkArgument(_.isNumber(seconds));
  if (seconds < 0 ||  seconds >= SEQUENCE_LOCKTIME_GRANULARITY * SEQUENCE_LOCKTIME_MASK) {
    throw new errors.Transaction.Input.LockTimeRange();
  }
  seconds = parseInt(Math.floor(seconds / SEQUENCE_LOCKTIME_GRANULARITY));

  // SEQUENCE_LOCKTIME_DISABLE_FLAG = 1 
  this.sequenceNumber = seconds | SEQUENCE_LOCKTIME_TYPE_FLAG ;
  return this;
};

/**
 * Sets sequence number so that transaction is not valid until the desired block height differnece since the tx is mined
 *
 * @param {Number} height
 * @return {Transaction} this
 */
Input.prototype.lockUntilBlockHeight = function(heightDiff) {
  $.checkArgument(_.isNumber(heightDiff));
  if (heightDiff < 0 || heightDiff >= SEQUENCE_BLOCKDIFF_LIMIT) {
    throw new errors.Transaction.Input.BlockHeightOutOfRange();
  }
  // SEQUENCE_LOCKTIME_TYPE_FLAG = 0
  // SEQUENCE_LOCKTIME_DISABLE_FLAG = 0
  this.sequenceNumber = heightDiff ;
  return this;
};


/**
 *  Returns a semantic version of the input's sequence nLockTime.
 *  @return {Number|Date}
 *  If sequence lock is disabled  it returns null,
 *  if is set to block height lock, returns a block height (number)
 *  else it returns a Date object.
 */
Input.prototype.getLockTime = function() {
  if (this.sequenceNumber & SEQUENCE_LOCKTIME_DISABLE_FLAG) {
    return null;
  }

  if (this.sequenceNumber & SEQUENCE_LOCKTIME_TYPE_FLAG) {
    var seconds = SEQUENCE_LOCKTIME_GRANULARITY * (this.sequenceNumber & SEQUENCE_LOCKTIME_MASK);
    return seconds;
  } else {
    var blockHeight = this.sequenceNumber & SEQUENCE_LOCKTIME_MASK;
    return blockHeight;
  }
};




module.exports = Input;
