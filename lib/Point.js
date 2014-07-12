"use strict";

var bignum = require('bignum');
var CPPKey = require('bindings')('KeyModule').Key;
var assert = require('assert');
var Point = require('./common/Point');

Point.add = function(p1, p2) {
  var u1 = p1.toUncompressedPubKey();
  var u2 = p2.toUncompressedPubKey();
  var pubKey = CPPKey.addUncompressed(u1, u2);
  return Point.fromUncompressedPubKey(pubKey);
};

Point.multiply = function(p1, x) {
  if (Buffer.isBuffer(x) && x.length !== 32)
    throw new Error('if x is a buffer, it must be 32 bytes')
  var u1 = p1.toUncompressedPubKey();
  if (typeof x === 'number' || typeof x === 'string')
    x = (new bignum(x)).toBuffer({size: 32});
  var pubKey = CPPKey.multiplyUncompressed(u1, x);
  return Point.fromUncompressedPubKey(pubKey);
};

module.exports = Point;
