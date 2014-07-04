"use strict";

var Key = require('./Key');
var bignum = require('bignum');
var assert = require('assert');
var elliptic = require('elliptic');

//a point on the secp256k1 curve
//x and y are bignums
var Point = function(x, y) {
  this.x = x;
  this.y = y;
};

Point.add = function(p1, p2) {
  var ec = elliptic.curves.secp256k1;
  var ecp1 = ec.curve.point(p1.x, p1.y);
  var ecp2 = ec.curve.point(p2.x, p2.y);
  var ecp3 = ecp1.add(ecp2);
  //var p3 = ec.curve.point(ecp3.x, ecp3.y);
  var p3 = new Point(ecp3.x, ecp3.y);
  return p3;
};

Point.multiply = function(p1, xbuf) {
  var ec = elliptic.curves.secp256k1;
  var ecp1 = ec.curve.point(p1.x, p1.y);
  var ecp = ecp1.mul(xbuf);
  var p = new Point(ecp.x, ecp.y);
  return p;
};

//convert the public key of a Key into a Point
Point.fromUncompressedPubKey = function(pubkey) {
  var point = new Point();
  point.x = bignum.fromBuffer((new Buffer(pubkey)).slice(1, 33), {
    size: 32
  });
  point.y = bignum.fromBuffer((new Buffer(pubkey)).slice(33, 65), {
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
  var pub = Buffer.concat([prefix, xbuf, ybuf]);
  return pub;
};

module.exports = (Point);
