'use strict';

var _ = require('lodash');
var buffer = require('buffer');
var assert = require('assert');

var isHexa = function isHexa(value) {
  if (!_.isString(value)) {
    return false;
  }
  return /^[0-9a-fA-F]+$/.test(value);
};

module.exports = {
  isValidJson: function isValidJson(arg) {
    try {
      JSON.parse(arg);
      return true;
    } catch (e) {
      return false;
    }
  },
  emptyBuffer: function emptyBuffer(bytes) {
    var result = new Buffer(bytes);
    for (var i = 0; i < bytes; i++) {
      result.write('\0', i);
    }
    return result;
  },
  integerAsSingleByteBuffer: function integerAsSingleByteBuffer(integer) {
    return new Buffer([integer & 0xff]);
  },
  integerAsBuffer: function integerAsBuffer(integer) {
    var bytes = [];
    bytes.push((integer >> 24) & 0xff);
    bytes.push((integer >> 16) & 0xff);
    bytes.push((integer >> 8) & 0xff);
    bytes.push(integer & 0xff);
    return new Buffer(bytes);
  },
  isHexa: isHexa,
  isHexaString: isHexa,

  integerFromBuffer: function integerFromBuffer(buffer) {
    return buffer[0] << 24 | buffer[1] << 16 | buffer[2] << 8 | buffer[3];
  },
  bufferToHex: function bufferToHex(buffer) {
    return buffer.toString('hex');
  },
  hexToBuffer: function hexToBuffer(string) {
    assert(isHexa(string));
    return new buffer.Buffer(string, 'hex');
  }
};
