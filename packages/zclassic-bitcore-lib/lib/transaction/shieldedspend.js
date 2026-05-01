'use strict';

var _ = require('lodash');
var $ = require('../util/preconditions');
var buffer = require('buffer');
var BufferWriter = require('../encoding/bufferwriter');
var BufferUtil = require('../util/buffer');

var GROTH_PROOF_SIZE = 48 + 96 + 48;

function ShieldedSpend(params) {
  if (!(this instanceof ShieldedSpend)) {
    return new ShieldedSpend(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

ShieldedSpend.fromObject = function(obj) {
  $.checkArgument(_.isObject(obj));
  var spend = new ShieldedSpend();
  return spend._fromObject(obj);
};

ShieldedSpend.prototype._fromObject = function(params) {
  this.cv = BufferUtil.reverse(new buffer.Buffer(params.cv, 'hex'));
  this.anchor = BufferUtil.reverse(new buffer.Buffer(params.anchor, 'hex'));
  this.nullifier = BufferUtil.reverse(new buffer.Buffer(params.nullifier, 'hex'));
  this.rk = BufferUtil.reverse(new buffer.Buffer(params.rk, 'hex'));
  this.zkproof = new buffer.Buffer(params.zkproof, 'hex');
  this.spendAuthSig = new buffer.Buffer(params.spendAuthSig, 'hex');
  return this;
};

ShieldedSpend.prototype.toObject = ShieldedSpend.prototype.toJSON = function toObject() {
  var obj = {
    cv: BufferUtil.reverse(this.cv).toString('hex'),
    anchor: BufferUtil.reverse(this.anchor).toString('hex'),
    nullifier: BufferUtil.reverse(this.nullifier).toString('hex'),
    rk: BufferUtil.reverse(this.rk).toString('hex'),
    zkproof: this.zkproof.toString('hex'),
    spendAuthSig: this.spendAuthSig.toString('hex'),
  };
  return obj;
};

ShieldedSpend.fromBufferReader = function(br) {
  var spend = new ShieldedSpend();
  spend.cv = br.read(32);
  spend.anchor = br.read(32);
  spend.nullifier = br.read(32);
  spend.rk= br.read(32);
  spend.zkproof = br.read(GROTH_PROOF_SIZE);
  spend.spendAuthSig = br.read(64);
  return spend;
};

ShieldedSpend.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.write(this.cv);
  writer.write(this.anchor);
  writer.write(this.nullifier);
  writer.write(this.rk);
  writer.write(this.zkproof);
  writer.write(this.spendAuthSig);
  return writer;
};

module.exports = ShieldedSpend;
