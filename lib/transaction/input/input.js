'use strict';

var _ = require('lodash');
var $ = require('../../util/preconditions');
var errors = require('../../errors');
var BufferWriter = require('../../encoding/bufferwriter');
var buffer = require('buffer');
var BufferUtil = require('../../util/buffer');
var JSUtil = require('../../util/js');
var Script = require('../../script');
var Sighash = require('../sighash');
var Output = require('../output');


var DEFAULT_SEQNUMBER = 0xFFFFFFFF;

function Input(params) {
  if (!(this instanceof Input)) {
    return new Input(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

Input.DEFAULT_SEQNUMBER = DEFAULT_SEQNUMBER;

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

Input.prototype._fromObject = function(params) {
  if (_.isString(params.prevTxId) && JSUtil.isHexa(params.prevTxId)) {
    params.prevTxId = new buffer.Buffer(params.prevTxId, 'hex');
  }
  this.output = params.output ?
    (params.output instanceof Output ? params.output : new Output(params.output)) : undefined;
  this.prevTxId = params.prevTxId || params.txidbuf;
  this.outputIndex = _.isUndefined(params.outputIndex) ? params.txoutnum : params.outputIndex;
  this.sequenceNumber = _.isUndefined(params.sequenceNumber) ?
    (_.isUndefined(params.seqnum) ? DEFAULT_SEQNUMBER : params.seqnum) : params.sequenceNumber;
  if (_.isUndefined(params.script) && _.isUndefined(params.scriptBuffer)) {
    throw new errors.Transaction.Input.MissingScript();
  }
  this.setScript(params.scriptBuffer || params.script);
  return this;
};

Input.prototype.toObject = function toObject() {
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

Input.fromObject = function(obj) {
  $.checkArgument(_.isObject(obj));
  var input = new Input();
  return input._fromObject(obj);
};

Input.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

Input.fromJSON = function(json) {
  $.checkArgument(JSUtil.isValidJSON(json), 'Invalid JSON provided to Input.fromJSON');
  return Input.fromObject(JSON.parse(json));
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
    this._scriptBuffer = new buffer.Buffer(script, 'hex');
  } else if (_.isString(script)) {
    // human readable string script
    this._script = new Script(script);
    this._script._isInput = true;
    this._scriptBuffer = this._script.toBuffer();
  } else if (BufferUtil.isBuffer(script)) {
    // buffer script
    this._scriptBuffer = new buffer.Buffer(script);
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
    ' for input: ' + this.toJSON()
  );
};

Input.prototype.isFullySigned = function() {
  throw new errors.AbstractMethodInvoked('Input#isFullySigned');
};

Input.prototype.isFinal = function() {
  return this.sequenceNumber !== 4294967295;
};

Input.prototype.addSignature = function() {
  throw new errors.AbstractMethodInvoked('Input#addSignature');
};

Input.prototype.clearSignatures = function() {
  throw new errors.AbstractMethodInvoked('Input#clearSignatures');
};

Input.prototype.isValidSignature = function(transaction, signature) {
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
 * @returns true if this is a coinbase input (represents no input)
 */
Input.prototype.isNull = function() {
  return this.prevTxId.toString('hex') === '0000000000000000000000000000000000000000000000000000000000000000' &&
    this.outputIndex === 0xffffffff;
};

Input.prototype._estimateSize = function() {
  return this.toBufferWriter().toBuffer().length;
};

module.exports = Input;
