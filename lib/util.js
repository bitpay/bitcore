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

var shallowEquals = function(obj1, obj2) {
  var keys1 = _.keys(obj1);
  var keys2 = _.keys(obj2);
  if (_.size(keys1) !== _.size(keys2)) {
    return false;
  }
  var compare = function(key) { return obj1[key] === obj2[key]; };
  return _.all(keys1, compare) && _.all(keys2, compare);
};

module.exports = {
  shallowEquals: shallowEquals,
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
  integerFromSingleByteBuffer: function integerFromBuffer(buffer) {
    return buffer[0];
  },
  bufferToHex: function bufferToHex(buffer) {
    return buffer.toString('hex');
  },
  hexToBuffer: function hexToBuffer(string) {
    assert(isHexa(string));
    return new buffer.Buffer(string, 'hex');
  },
  pointToCompressed: function pointToCompressed(point) {
    var xbuf = point.getX().toBuffer({size: 32});
    var ybuf = point.getY().toBuffer({size: 32});

    var prefix;
    var odd = ybuf[ybuf.length - 1] % 2;
    if (odd) {
      prefix = new Buffer([0x03]);
    } else {
      prefix = new Buffer([0x02]);
    }
    return buffer.Buffer.concat([prefix, xbuf]);
  }
};
