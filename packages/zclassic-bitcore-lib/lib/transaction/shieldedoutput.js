'use strict';

var _ = require('lodash');
var $ = require('../util/preconditions');
var buffer = require('buffer');
var BufferWriter = require('../encoding/bufferwriter');
var BufferUtil = require('../util/buffer');

var NOTEENCRYPTION_AUTH_BYTES = 16
var ZC_NOTEPLAINTEXT_LEADING = 1
var ZC_V_SIZE = 8
var ZC_RHO_SIZE = 32
var ZC_R_SIZE = 32
var ZC_MEMO_SIZE = 512
var ZC_DIVERSIFIER_SIZE = 11
var ZC_JUBJUB_POINT_SIZE = 32
var ZC_JUBJUB_SCALAR_SIZE = 32

var ZC_NOTEPLAINTEXT_SIZE = ZC_NOTEPLAINTEXT_LEADING + ZC_V_SIZE + ZC_RHO_SIZE + ZC_R_SIZE + ZC_MEMO_SIZE;
var ZC_SAPLING_ENCPLAINTEXT_SIZE = ZC_NOTEPLAINTEXT_LEADING + ZC_DIVERSIFIER_SIZE + ZC_V_SIZE + ZC_R_SIZE + ZC_MEMO_SIZE;
var ZC_SAPLING_OUTPLAINTEXT_SIZE = ZC_JUBJUB_POINT_SIZE + ZC_JUBJUB_SCALAR_SIZE;
var ZC_SAPLING_ENCCIPHERTEXT_SIZE = ZC_SAPLING_ENCPLAINTEXT_SIZE + NOTEENCRYPTION_AUTH_BYTES;
var ZC_SAPLING_OUTCIPHERTEXT_SIZE = ZC_SAPLING_OUTPLAINTEXT_SIZE + NOTEENCRYPTION_AUTH_BYTES;
var GROTH_PROOF_SIZE = 48 + 96 + 48;

function ShieldedOutput(params) {
  if (!(this instanceof ShieldedOutput)) {
    return new ShieldedOutput(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

ShieldedOutput.fromObject = function(obj) {
  $.checkArgument(_.isObject(obj));
  var output = new ShieldedOutput();
  return output._fromObject(obj);
};

ShieldedOutput.prototype._fromObject = function(params) {
  this.cv = BufferUtil.reverse(new buffer.Buffer(params.cv, 'hex'));
  this.cm = BufferUtil.reverse(new buffer.Buffer(params.cm, 'hex'));
  this.ephemeralKey = BufferUtil.reverse(new buffer.Buffer(params.ephemeralKey, 'hex'));
  this.encCiphertext = new buffer.Buffer(params.encCiphertext, 'hex');
  this.outCiphertext = new buffer.Buffer(params.outCiphertext, 'hex');
  this.zkproof = new buffer.Buffer(params.zkproof, 'hex');
  return this;
};

ShieldedOutput.prototype.toObject = ShieldedOutput.prototype.toJSON = function toObject() {
  var obj = {
    cv: BufferUtil.reverse(this.cv).toString('hex'),
    cm: BufferUtil.reverse(this.cm).toString('hex'),
    ephemeralKey: BufferUtil.reverse(this.ephemeralKey).toString('hex'),
    encCiphertext: this.encCiphertext.toString('hex'),
    outCiphertext: this.outCiphertext.toString('hex'),
    zkproof: this.zkproof.toString('hex'),
  };
  return obj;
};

ShieldedOutput.fromBufferReader = function(br) {
  var output = new ShieldedOutput();
  output.cv = br.read(32);
  output.cm = br.read(32);
  output.ephemeralKey = br.read(32);
  output.encCiphertext = br.read(ZC_SAPLING_ENCCIPHERTEXT_SIZE);
  output.outCiphertext = br.read(ZC_SAPLING_OUTCIPHERTEXT_SIZE);
  output.zkproof = br.read(GROTH_PROOF_SIZE);
  return output;
};

ShieldedOutput.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.write(this.cv);
  writer.write(this.cm);
  writer.write(this.ephemeralKey);
  writer.write(this.encCiphertext);
  writer.write(this.outCiphertext);
  writer.write(this.zkproof);
  return writer;
};

module.exports = ShieldedOutput;
