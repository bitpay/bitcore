'use strict';

var _ = require('lodash');
var bs58 = require('bs58');
var buffer = require('buffer');

var ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split('');

var Base58 = function Base58(obj) {
  /* jshint maxcomplexity: 8 */
  if (!(this instanceof Base58)) {
    return new Base58(obj);
  }
  if (Buffer.isBuffer(obj)) {
    var buf = obj;
    this.fromBuffer(buf);
  } else if (typeof obj === 'string') {
    var str = obj;
    this.fromString(str);
  } else if (obj) {
    this.set(obj);
  }
};

Base58.validCharacters = function validCharacters(chars) {
  if (buffer.Buffer.isBuffer(chars)) {
    chars = chars.toString();
  }
  return _.every(_.map(chars, function(char) { return _.includes(ALPHABET, char); }));
};

Base58.prototype.set = function(obj) {
  this.buf = obj.buf || this.buf || undefined;
  return this;
};

Base58.encode = function(buf) {
  if (!buffer.Buffer.isBuffer(buf)) {
    throw new Error('Input should be a buffer');
  }
  return bs58.encode(buf);
};

Base58.decode = function(str) {
  if (typeof str !== 'string') {
    throw new Error('Input should be a string');
  }
  return new Buffer(bs58.decode(str));
};

Base58.prototype.fromBuffer = function(buf) {
  this.buf = buf;
  return this;
};

Base58.prototype.fromString = function(str) {
  var buf = Base58.decode(str);
  this.buf = buf;
  return this;
};

Base58.prototype.toBuffer = function() {
  return this.buf;
};

Base58.prototype.toString = function() {
  return Base58.encode(this.buf);
};

module.exports = Base58;
