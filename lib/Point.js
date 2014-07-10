"use strict";

var bignum = require('bignum');
var CPPKey = require('bindings')('KeyModule').Key;
var assert = require('assert');

//a point on the secp256k1 curve
//x and y are bignums
var Point = function(x, y) {
  this.x = x;
  this.y = y;
};

Point.add = function(p1, p2) {
  var u1 = p1.toUncompressedPubKey();
  var u2 = p2.toUncompressedPubKey();
  var pubKey = CPPKey.addUncompressed(u1, u2);
  return Point.fromUncompressedPubKey(pubKey);
};

Point.multiply = function(p1, x) {
  var u1 = p1.toUncompressedPubKey();
  var pubKey = CPPKey.multiplyUncompressed(u1, x);
  return Point.fromUncompressedPubKey(pubKey);
};

//convert the public key of a Key into a Point
Point.fromUncompressedPubKey = function(pubkey) {
  var point = new Point();
  point.x = bignum.fromBuffer(pubkey.slice(1, 33), {
    size: 32
  });
  point.y = bignum.fromBuffer(pubkey.slice(33, 65), {
    size: 32
  });
  return point;
};

//convert the Point into the Key containing a compressed public key
Point.prototype.toUncompressedPubKey = function() {
  var xbuf = this.x.toBuffer({
    size: 32
  });
  var ybuf = this.y.toBuffer({
    size: 32
  });
  var prefix = new Buffer([0x04]);
  var pubkey = Buffer.concat([prefix, xbuf, ybuf]);
  return pubkey;
};

module.exports = (Point);
