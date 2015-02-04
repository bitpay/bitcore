'use strict';

var _ = require('lodash');
var errors = require('../../errors');
var BufferWriter = require('../../encoding/bufferwriter');
var buffer = require('buffer');
var BufferUtil = require('../../util/buffer');
var JSUtil = require('../../util/js');
var Script = require('../../script');
var Sighash = require('../sighash');
var Output = require('../output');

function Input(params) {
  if (!(this instanceof Input)) {
    return new Input(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

Object.defineProperty(Input.prototype, 'script', {
  configurable: false,
  writeable: false,
  enumerable: true,
  get: function() {
    if (!this._script) {
      this._script = new Script(this._scriptBuffer);
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
  this.prevTxId = params.prevTxId;
  this.outputIndex = params.outputIndex;
  this.sequenceNumber = params.sequenceNumber;
  if (!_.isUndefined(params.script) || !_.isUndefined(params.scriptBuffer)) {
    this.setScript(_.isUndefined(params.script) ? params.scriptBuffer : params.script);
  } else {
    throw new errors.Transaction.Input.MissingScript();
  }
  return this;
};

Input.prototype.toObject = function toObject() {
  return {
    prevTxId: this.prevTxId.toString('hex'),
    outputIndex: this.outputIndex,
    sequenceNumber: this.sequenceNumber,
    script: this.script.toString(),
    output: this.output ? this.output.toObject() : undefined
  };
};

Input.prototype.toJSON = function toJSON() {
  return JSON.stringify(this.toObject());
};

Input.fromJSON = function(json) {
  if (JSUtil.isValidJSON(json)) {
    json = JSON.parse(json);
  }
  return new Input({
    output: json.output ? new Output(json.output) : undefined,
    prevTxId: json.prevTxId || json.txidbuf,
    outputIndex: _.isUndefined(json.outputIndex) ? json.txoutnum : json.outputIndex,
    sequenceNumber: json.sequenceNumber || json.seqnum,
    scriptBuffer: new Script(json.script, 'hex')
  });
};

Input.fromBufferReader = function(br) {
  var input = new Input();
  input.prevTxId = br.readReverse(32);
  input.outputIndex = br.readUInt32LE();
  input._scriptBuffer = br.readVarLengthBuffer();
  input.sequenceNumber = br.readUInt32LE();
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
  if (script instanceof Script) {
    this._script = script;
    this._scriptBuffer = script.toBuffer();
  } else if (_.isString(script)) {
    this._script = new Script(script);
    this._scriptBuffer = this._script.toBuffer();
  } else if (BufferUtil.isBuffer(script)) {
    this._script = null;
    this._scriptBuffer = new buffer.Buffer(script);
  } else {
    throw new TypeError('Invalid Argument');
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
  throw new errors.AbstractMethodInvoked('Input#getSignatures');
};

Input.prototype.isFullySigned = function() {
  throw new errors.AbstractMethodInvoked('Input#isFullySigned');
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
  var bufferWriter = new BufferWriter();
  this.toBufferWriter(bufferWriter);
  return bufferWriter.toBuffer().length;
};

module.exports = Input;
