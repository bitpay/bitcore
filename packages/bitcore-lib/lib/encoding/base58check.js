'use strict';

const _ = require('lodash');
const sha256sha256 = require('../crypto/hash').sha256sha256;
const Base58 = require('./base58');

const Base58Check = function Base58Check(obj) {
  if (!(this instanceof Base58Check))
    return new Base58Check(obj);
  if (Buffer.isBuffer(obj)) {
    const buf = obj;
    this.fromBuffer(buf);
  } else if (typeof obj === 'string') {
    const str = obj;
    this.fromString(str);
  } else if (obj) {
    this.set(obj);
  }
};

Base58Check.prototype.set = function(obj) {
  this.buf = obj.buf || this.buf || undefined;
  return this;
};

Base58Check.validChecksum = function validChecksum(data, checksum) {
  if (_.isString(data)) {
    data = Buffer.from(Base58.decode(data));
  }
  if (_.isString(checksum)) {
    checksum = Buffer.from(Base58.decode(checksum));
  }
  if (!checksum) {
    checksum = data.slice(-4);
    data = data.slice(0, -4);
  }
  return Base58Check.checksum(data).toString('hex') === checksum.toString('hex');
};

Base58Check.decode = function(s) {
  if (typeof s !== 'string')
    throw new Error('Input must be a string');

  const buf = Buffer.from(Base58.decode(s));

  if (buf.length < 4)
    throw new Error('Input string too short');

  const data = buf.slice(0, -4);
  const csum = buf.slice(-4);

  const hash = sha256sha256(data);
  const hash4 = hash.slice(0, 4);

  if (csum.toString('hex') !== hash4.toString('hex'))
    throw new Error('Checksum mismatch');

  return data;
};

Base58Check.checksum = function(buffer) {
  return sha256sha256(buffer).slice(0, 4);
};

Base58Check.encode = function(buf) {
  if (!Buffer.isBuffer(buf))
    throw new Error('Input must be a buffer');
  const checkedBuf = Buffer.alloc(buf.length + 4);
  const hash = Base58Check.checksum(buf);
  buf.copy(checkedBuf);
  hash.copy(checkedBuf, buf.length);
  return Base58.encode(checkedBuf);
};

Base58Check.prototype.fromBuffer = function(buf) {
  this.buf = buf;
  return this;
};

Base58Check.prototype.fromString = function(str) {
  const buf = Base58Check.decode(str);
  this.buf = buf;
  return this;
};

Base58Check.prototype.toBuffer = function() {
  return this.buf;
};

Base58Check.prototype.toString = function() {
  return Base58Check.encode(this.buf);
};

module.exports = Base58Check;
