'use strict';

var $ = require('../util/preconditions');
var buffer = require('buffer');
var BufferWriter = require('../encoding/bufferwriter');

var G1_PREFIX_MASK = 0x02;
var G2_PREFIX_MASK = 0x0a;

function CompressedG1(params) {
  if (!(this instanceof CompressedG1)) {
    return new CompressedG1(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

CompressedG1.fromObject = function(obj) {
  $.checkArgument(_.isObject(obj));
  var pt = new CompressedG1();
  return pt._fromObject(obj);
};

CompressedG1.prototype._fromObject = function(params) {
  this.y_lsb = params.y_lsb;
  this.x = new buffer.Buffer(params.x, 'hex');
  return this;
};

CompressedG1.prototype.toObject = CompressedG1.prototype.toJSON = function toObject() {
  var obj = {
    y_lsb: this.y_lsb,
    x: this.x.toString('hex'),
  };
  return obj;
};

CompressedG1.fromBufferReader = function(br) {
  var pt = new CompressedG1();
  var y_lsb = br.readUInt8();
  pt.y_lsb = y_lsb & 1;
  pt.x = br.read(32);
  return pt;
};

CompressedG1.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeUInt8(G1_PREFIX_MASK | this.y_lsb);
  writer.write(this.x);
  return writer;
};

function CompressedG2(params) {
  if (!(this instanceof CompressedG2)) {
    return new CompressedG2(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

CompressedG2.fromObject = function(obj) {
  $.checkArgument(_.isObject(obj));
  var pt = new CompressedG2();
  return pt._fromObject(obj);
};

CompressedG2.prototype._fromObject = function(params) {
  this.y_gt = params.y_gt;
  this.x = new buffer.Buffer(params.x, 'hex');
  return this;
};

CompressedG2.prototype.toObject = CompressedG2.prototype.toJSON = function toObject() {
  var obj = {
    y_gt: this.y_gt,
    x: this.x.toString('hex'),
  };
  return obj;
};

CompressedG2.fromBufferReader = function(br) {
  var pt = new CompressedG2();
  var y_gt = br.readUInt8();
  pt.y_gt = y_gt & 1;
  pt.x = br.read(64);
  return pt;
};

CompressedG2.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  writer.writeUInt8(G2_PREFIX_MASK | this.y_gt);
  writer.write(this.x);
  return writer;
};

function ZCProof(params) {
  if (!(this instanceof ZCProof)) {
    return new ZCProof(params);
  }
  if (params) {
    return this._fromObject(params);
  }
}

ZCProof.fromObject = function(obj) {
  $.checkArgument(_.isObject(obj));
  var proof = new ZCProof();
  return proof._fromObject(obj);
};

ZCProof.prototype._fromObject = function(params) {
  this.g_A       = CompressedG1.fromObject(params.g_A);
  this.g_A_prime = CompressedG1.fromObject(params.g_A_prime);
  this.g_B       = CompressedG2.fromObject(params.g_B);
  this.g_B_prime = CompressedG1.fromObject(params.g_B_prime);
  this.g_C       = CompressedG1.fromObject(params.g_C);
  this.g_C_prime = CompressedG1.fromObject(params.g_C_prime);
  this.g_K       = CompressedG1.fromObject(params.g_K);
  this.g_H       = CompressedG1.fromObject(params.g_H);
  return this;
};

ZCProof.prototype.toObject = ZCProof.prototype.toJSON = function toObject() {
  var obj = {
    g_A:       this.g_A.toObject(),
    g_A_prime: this.g_A_prime.toObject(),
    g_B:       this.g_B.toObject(),
    g_B_prime: this.g_B_prime.toObject(),
    g_C:       this.g_C.toObject(),
    g_C_prime: this.g_C_prime.toObject(),
    g_K:       this.g_K.toObject(),
    g_H:       this.g_H.toObject(),
  };
  return obj;
};

ZCProof.fromBufferReader = function(br) {
  var proof = new ZCProof();
  proof.g_A       = CompressedG1.fromBufferReader(br);
  proof.g_A_prime = CompressedG1.fromBufferReader(br);
  proof.g_B       = CompressedG2.fromBufferReader(br);
  proof.g_B_prime = CompressedG1.fromBufferReader(br);
  proof.g_C       = CompressedG1.fromBufferReader(br);
  proof.g_C_prime = CompressedG1.fromBufferReader(br);
  proof.g_K       = CompressedG1.fromBufferReader(br);
  proof.g_H       = CompressedG1.fromBufferReader(br);
  return proof;
};

ZCProof.prototype.toBufferWriter = function(writer) {
  if (!writer) {
    writer = new BufferWriter();
  }
  this.g_A.toBufferWriter(writer);
  this.g_A_prime.toBufferWriter(writer);
  this.g_B.toBufferWriter(writer);
  this.g_B_prime.toBufferWriter(writer);
  this.g_C.toBufferWriter(writer);
  this.g_C_prime.toBufferWriter(writer);
  this.g_K.toBufferWriter(writer);
  this.g_H.toBufferWriter(writer);
  return writer;
};

module.exports = ZCProof;
