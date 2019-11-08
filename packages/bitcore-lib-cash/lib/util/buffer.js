'use strict';

var buffer = require('buffer');
var assert = require('assert');

var js = require('./js');
var $ = require('./preconditions');

function equals(a, b) {
  if (a.length !== b.length) {
    return false;
  }
  var length = a.length;
  for (var i = 0; i < length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

module.exports = {
  /**
   * Fill a buffer with a value.
   *
   * @param {Buffer} buffer
   * @param {number} value
   * @return {Buffer}
   */
  fill: function fill(buffer, value) {
    $.checkArgumentType(buffer, 'Buffer', 'buffer');
    $.checkArgumentType(value, 'number', 'value');
    var length = buffer.length;
    for (var i = 0; i < length; i++) {
      buffer[i] = value;
    }
    return buffer;
  },

  /**
   * Return a copy of a buffer
   *
   * @param {Buffer} original
   * @return {Buffer}
   */
  copy: function(original) {
    var buffer = Buffer.alloc(original.length);
    original.copy(buffer);
    return buffer;
  },

  /**
   * Returns true if the given argument is an instance of a buffer. Tests for
   * both node's Buffer and Uint8Array
   *
   * @param {*} arg
   * @return {boolean}
   */
  isBuffer: function isBuffer(arg) {
    return buffer.Buffer.isBuffer(arg) || arg instanceof Uint8Array;
  },

  /**
   * Returns a zero-filled byte array
   *
   * @param {number} bytes
   * @return {Buffer}
   */
  emptyBuffer: function emptyBuffer(bytes) {
    $.checkArgumentType(bytes, 'number', 'bytes');
    var result = Buffer.alloc(bytes);
    for (var i = 0; i < bytes; i++) {
      result.write('\0', i);
    }
    return result;
  },

  /**
   * Concatenates a buffer
   *
   * Shortcut for <tt>buffer.Buffer.concat</tt>
   */
  concat: buffer.Buffer.concat,

  equals: equals,
  equal: equals,

  /**
   * Transforms a number from 0 to 255 into a Buffer of size 1 with that value
   *
   * @param {number} integer
   * @return {Buffer}
   */
  integerAsSingleByteBuffer: function integerAsSingleByteBuffer(integer) {
    $.checkArgumentType(integer, 'number', 'integer');
    return Buffer.from([integer & 0xff]);
  },

  /**
   * Transform a 4-byte integer into a Buffer of length 4.
   *
   * @param {number} integer
   * @return {Buffer}
   */
  integerAsBuffer: function integerAsBuffer(integer) {
    $.checkArgumentType(integer, 'number', 'integer');
    var bytes = [];
    bytes.push((integer >> 24) & 0xff);
    bytes.push((integer >> 16) & 0xff);
    bytes.push((integer >> 8) & 0xff);
    bytes.push(integer & 0xff);
    return Buffer.from(bytes);
  },

  /**
   * Transform the first 4 values of a Buffer into a number, in little endian encoding
   *
   * @param {Buffer} buffer
   * @return {number}
   */
  integerFromBuffer: function integerFromBuffer(buffer) {
    $.checkArgumentType(buffer, 'Buffer', 'buffer');
    return buffer[0] << 24 | buffer[1] << 16 | buffer[2] << 8 | buffer[3];
  },

  /**
   * Transforms the first byte of an array into a number ranging from -128 to 127
   * @param {Buffer} buffer
   * @return {number}
   */
  integerFromSingleByteBuffer: function integerFromBuffer(buffer) {
    $.checkArgumentType(buffer, 'Buffer', 'buffer');
    return buffer[0];
  },

  /**
   * Transforms a buffer into a string with a number in hexa representation
   *
   * Shorthand for <tt>buffer.toString('hex')</tt>
   *
   * @param {Buffer} buffer
   * @return {string}
   */
  bufferToHex: function bufferToHex(buffer) {
    $.checkArgumentType(buffer, 'Buffer', 'buffer');
    return buffer.toString('hex');
  },

  /**
   * Reverse a buffer
   * @param {Buffer} param
   * @return {Buffer}
   */
  reverse: function reverse(param) {
    return (Buffer.from(param)).reverse();
  },


};

module.exports.NULL_HASH = module.exports.fill(Buffer.alloc(32), 0);
module.exports.EMPTY_BUFFER = Buffer.alloc(0);
