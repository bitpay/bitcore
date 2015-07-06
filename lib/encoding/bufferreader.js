'use strict';

var _ = require('lodash');
var $ = require('../util/preconditions');
var BufferUtil = require('../util/buffer');
var BN = require('../crypto/bn');

var BufferReader = function BufferReader(buf) {
  if (!(this instanceof BufferReader)) {
    return new BufferReader(buf);
  }
  if (_.isUndefined(buf)) {
    return;
  }
  if (Buffer.isBuffer(buf)) {
    this.set({
      buf: buf
    });
  } else if (_.isString(buf)) {
    this.set({
      buf: new Buffer(buf, 'hex'),
    });
  } else if (_.isObject(buf)) {
    var obj = buf;
    this.set(obj);
  } else {
    throw new TypeError('Unrecognized argument for BufferReader');
  }
};

BufferReader.prototype.set = function(obj) {
  this.buf = obj.buf || this.buf || undefined;
  this.pos = obj.pos || this.pos || 0;
  return this;
};

BufferReader.prototype.eof = function() {
  return this.pos >= this.buf.length;
};

BufferReader.prototype.finished = BufferReader.prototype.eof;

BufferReader.prototype.read = function(len) {
  $.checkArgument(!_.isUndefined(len), 'Must specify a length');
  var buf = this.buf.slice(this.pos, this.pos + len);
  this.pos = this.pos + len;
  return buf;
};

BufferReader.prototype.readAll = function() {
  var buf = this.buf.slice(this.pos, this.buf.length);
  this.pos = this.buf.length;
  return buf;
};

BufferReader.prototype.readUInt8 = function() {
  var val = this.buf.readUInt8(this.pos);
  this.pos = this.pos + 1;
  return val;
};

BufferReader.prototype.readUInt16BE = function() {
  var val = this.buf.readUInt16BE(this.pos);
  this.pos = this.pos + 2;
  return val;
};

BufferReader.prototype.readUInt16LE = function() {
  var val = this.buf.readUInt16LE(this.pos);
  this.pos = this.pos + 2;
  return val;
};

BufferReader.prototype.readUInt32BE = function() {
  var val = this.buf.readUInt32BE(this.pos);
  this.pos = this.pos + 4;
  return val;
};

BufferReader.prototype.readUInt32LE = function() {
  var val = this.buf.readUInt32LE(this.pos);
  this.pos = this.pos + 4;
  return val;
};

BufferReader.prototype.readUInt64BEBN = function() {
  var buf = this.buf.slice(this.pos, this.pos + 8);
  var bn = BN.fromBuffer(buf);
  this.pos = this.pos + 8;
  return bn;
};

BufferReader.prototype.readUInt64LEBN = function() {
  var second = this.buf.readUInt32LE(this.pos);
  var first = this.buf.readUInt32LE(this.pos + 4);
  var combined = (first * 0x100000000) + second;
  // Instantiating an instance of BN with a number is faster than with an
  // array or string. However, the maximum safe number for a double precision
  // floating point is 2 ^ 52 - 1 (0x1fffffffffffff), thus we can safely use
  // non-floating point numbers less than this amount (52 bits). And in the case
  // that the number is larger, we can instatiate an instance of BN by passing
  // an array from the buffer (slower) and specifying the endianness.
  var bn;
  if (combined <= 0x1fffffffffffff) {
    bn = new BN(combined);
  } else {
    var data = Array.prototype.slice.call(this.buf, this.pos, this.pos + 8);
    bn = new BN(data, 10, 'le');
  }
  this.pos = this.pos + 8;
  return bn;
};

BufferReader.prototype.readVarintNum = function() {
  var first = this.readUInt8();
  switch (first) {
    case 0xFD:
      return this.readUInt16LE();
    case 0xFE:
      return this.readUInt32LE();
    case 0xFF:
      var bn = this.readUInt64LEBN();
      var n = bn.toNumber();
      if (n <= Math.pow(2, 53)) {
        return n;
      } else {
        throw new Error('number too large to retain precision - use readVarintBN');
      }
      break;
    default:
      return first;
  }
};

/**
 * reads a length prepended buffer
 */
BufferReader.prototype.readVarLengthBuffer = function() {
  var len = this.readVarintNum();
  var buf = this.read(len);
  $.checkState(buf.length === len, 'Invalid length while reading varlength buffer. ' +
    'Expected to read: ' + len + ' and read ' + buf.length);
  return buf;
};

BufferReader.prototype.readVarintBuf = function() {
  var first = this.buf.readUInt8(this.pos);
  switch (first) {
    case 0xFD:
      return this.read(1 + 2);
    case 0xFE:
      return this.read(1 + 4);
    case 0xFF:
      return this.read(1 + 8);
    default:
      return this.read(1);
  }
};

BufferReader.prototype.readVarintBN = function() {
  var first = this.readUInt8();
  switch (first) {
    case 0xFD:
      return new BN(this.readUInt16LE());
    case 0xFE:
      return new BN(this.readUInt32LE());
    case 0xFF:
      return this.readUInt64LEBN();
    default:
      return new BN(first);
  }
};

BufferReader.prototype.reverse = function() {
  var buf = new Buffer(this.buf.length);
  for (var i = 0; i < buf.length; i++) {
    buf[i] = this.buf[this.buf.length - 1 - i];
  }
  this.buf = buf;
  return this;
};

BufferReader.prototype.readReverse = function(len) {
  if (_.isUndefined(len)) {
    len = this.buf.length;
  }
  var buf = this.buf.slice(this.pos, this.pos + len);
  this.pos = this.pos + len;
  return BufferUtil.reverse(buf);
};

module.exports = BufferReader;
