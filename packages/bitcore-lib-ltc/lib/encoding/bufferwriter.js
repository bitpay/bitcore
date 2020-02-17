'use strict';

var bufferUtil = require('../util/buffer');
var assert = require('assert');

var BufferWriter = function BufferWriter(obj) {
  if (!(this instanceof BufferWriter))
    return new BufferWriter(obj);
  this.bufLen = 0;
  if (obj)
    this.set(obj);
  else
    this.bufs = [];
};

BufferWriter.prototype.set = function(obj) {
  this.bufs = obj.bufs || this.bufs || [];
  this.bufLen = this.bufs.reduce(function(prev, buf){ return prev + buf.length; }, 0);
  return this;
};

BufferWriter.prototype.toBuffer = function() {
  return this.concat();
};

BufferWriter.prototype.concat = function() {
  return Buffer.concat(this.bufs, this.bufLen);
};

BufferWriter.prototype.write = function(buf) {
  assert(bufferUtil.isBuffer(buf));
  this.bufs.push(buf);
  this.bufLen += buf.length;
  return this;
};

BufferWriter.prototype.writeReverse = function(buf) {
  assert(bufferUtil.isBuffer(buf));
  this.bufs.push(bufferUtil.reverse(buf));
  this.bufLen += buf.length;
  return this;
};

BufferWriter.prototype.writeUInt8 = function(n) {
  var buf = Buffer.alloc(1);
  buf.writeUInt8(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt16BE = function(n) {
  var buf = Buffer.alloc(2);
  buf.writeUInt16BE(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt16LE = function(n) {
  var buf = Buffer.alloc(2);
  buf.writeUInt16LE(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt32BE = function(n) {
  var buf = Buffer.alloc(4);
  buf.writeUInt32BE(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeInt32LE = function(n) {
  var buf = Buffer.alloc(4);
  buf.writeInt32LE(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt32LE = function(n) {
  var buf = Buffer.alloc(4);
  buf.writeUInt32LE(n, 0);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt64BEBN = function(bn) {
  var buf = bn.toBuffer({size: 8});
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeUInt64LEBN = function(bn) {
  var buf = bn.toBuffer({size: 8});
  this.writeReverse(buf);
  return this;
};

BufferWriter.prototype.writeVarintNum = function(n) {
  var buf = BufferWriter.varintBufNum(n);
  this.write(buf);
  return this;
};

BufferWriter.prototype.writeVarintBN = function(bn) {
  var buf = BufferWriter.varintBufBN(bn);
  this.write(buf);
  return this;
};

BufferWriter.varintBufNum = function(n) {
  var buf = undefined;
  if (n < 253) {
    buf = Buffer.alloc(1);
    buf.writeUInt8(n, 0);
  } else if (n < 0x10000) {
    buf = Buffer.alloc(1 + 2);
    buf.writeUInt8(253, 0);
    buf.writeUInt16LE(n, 1);
  } else if (n < 0x100000000) {
    buf = Buffer.alloc(1 + 4);
    buf.writeUInt8(254, 0);
    buf.writeUInt32LE(n, 1);
  } else {
    buf = Buffer.alloc(1 + 8);
    buf.writeUInt8(255, 0);
    buf.writeInt32LE(n & -1, 1);
    buf.writeUInt32LE(Math.floor(n / 0x100000000), 5);
  }
  return buf;
};

BufferWriter.varintBufBN = function(bn) {
  var buf = undefined;
  var n = bn.toNumber();
  if (n < 253) {
    buf = Buffer.alloc(1);
    buf.writeUInt8(n, 0);
  } else if (n < 0x10000) {
    buf = Buffer.alloc(1 + 2);
    buf.writeUInt8(253, 0);
    buf.writeUInt16LE(n, 1);
  } else if (n < 0x100000000) {
    buf = Buffer.alloc(1 + 4);
    buf.writeUInt8(254, 0);
    buf.writeUInt32LE(n, 1);
  } else {
    var bw = new BufferWriter();
    bw.writeUInt8(255);
    bw.writeUInt64LEBN(bn);
    var buf = bw.concat();
  }
  return buf;
};

module.exports = BufferWriter;
