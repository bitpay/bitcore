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
var Output = require('../output');

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

Input.prototype.isValidSignature = function(transaction, signature, signingMethod) {
  // FIXME: Refactor signature so this is not necessary
  signingMethod = signingMethod || 'ecdsa';
  signature.signature.nhashtype = signature.sigtype;
  return Sighash.verify(
    transaction,
    signature.signature,
    signature.publicKey,
    signature.inputIndex,
    this.output.script,
    signingMethod
  );
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
