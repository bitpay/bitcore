'use strict';

const bs58 = require('bs58');

const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'.split('');

const Base58 = function Base58(obj) {
  /* jshint maxcomplexity: 8 */
  if (!(this instanceof Base58)) {
    return new Base58(obj);
  }
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

Base58.validCharacters = function validCharacters(chars) {
  if (Buffer.isBuffer(chars)) {
    chars = chars.toString();
  }
  // Backwards compat: lodash _.map(null/undefined) yields [], _.every([]) is true.
  if (chars == null) {
    return true;
  }
  if (typeof chars !== 'string') {
    // Backwards compat: lodash _.map on non-string primitives (number, boolean, etc.) yields [].
    // Boxed strings must be unwrapped: lodash maps each character of String objects.
    if (chars instanceof String) {
      chars = chars.valueOf();
    } else {
      return true;
    }
  }
  return Array.prototype.every.call(chars, char => ALPHABET.includes(char));
};

Base58.prototype.set = function(obj) {
  this.buf = obj.buf || this.buf || undefined;
  return this;
};

Base58.encode = function(buf) {
  if (!Buffer.isBuffer(buf)) {
    throw new Error('Input should be a buffer');
  }
  return bs58.encode(buf);
};

Base58.decode = function(str) {
  if (typeof str !== 'string') {
    throw new Error('Input should be a string');
  }
  return Buffer.from(bs58.decode(str));
};

Base58.prototype.fromBuffer = function(buf) {
  this.buf = buf;
  return this;
};

Base58.prototype.fromString = function(str) {
  const buf = Base58.decode(str);
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
