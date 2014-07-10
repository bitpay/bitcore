"use strict";

var Key = require('./Key');
var bignum = require('bignum');
var assert = require('assert');
var ECPointFp = require('../../browser/vendor-bundle.js').ECPointFp;
var ECFieldElementFp = require('../../browser/vendor-bundle.js').ECFieldElementFp;
var getSECCurveByName = require('../../browser/vendor-bundle.js').getSECCurveByName;
var BigInteger = require('../../browser/vendor-bundle.js').BigInteger;

//a point on the secp256k1 curve
//x and y are bignums
var Point = function(x, y) {
  this.x = x;
  this.y = y;
};

Point.add = function(p1, p2) {
  var ecparams = getSECCurveByName('secp256k1');

  var p1xhex = p1.x.toBuffer({
    size: 32
  }).toString('hex');
  var p1x = new BigInteger(p1xhex, 16);
  var p1yhex = p1.y.toBuffer({
    size: 32
  }).toString('hex');
  var p1y = new BigInteger(p1yhex, 16);
  var p1px = new ECFieldElementFp(ecparams.getCurve().getQ(), p1x);
  var p1py = new ECFieldElementFp(ecparams.getCurve().getQ(), p1y);
  var p1p = new ECPointFp(ecparams.getCurve(), p1px, p1py);

  var p2xhex = p2.x.toBuffer({
    size: 32
  }).toString('hex');
  var p2x = new BigInteger(p2xhex, 16);
  var p2yhex = p2.y.toBuffer({
    size: 32
  }).toString('hex');
  var p2y = new BigInteger(p2yhex, 16);
  var p2px = new ECFieldElementFp(ecparams.getCurve().getQ(), p2x);
  var p2py = new ECFieldElementFp(ecparams.getCurve().getQ(), p2y);
  var p2p = new ECPointFp(ecparams.getCurve(), p2px, p2py);

  var p = p1p.add(p2p);

  var point = new Point();
  var pointxbuf = new Buffer(p.getX().toBigInteger().toByteArrayUnsigned());
  point.x = bignum.fromBuffer(pointxbuf, {
    size: pointxbuf.length
  });
  assert(pointxbuf.length <= 32);
  var pointybuf = new Buffer(p.getY().toBigInteger().toByteArrayUnsigned());
  assert(pointybuf.length <= 32);
  point.y = bignum.fromBuffer(pointybuf, {
    size: pointybuf.length
  });

  return point;
};

Point.multiply = function(p1, x) {
  var x = new BigInteger(x.toString('hex'), 16);

  var ecparams = getSECCurveByName('secp256k1');

  var p1xhex = p1.x.toBuffer({
    size: 32
  }).toString('hex');
  var p1x = new BigInteger(p1xhex, 16);
  var p1yhex = p1.y.toBuffer({
    size: 32
  }).toString('hex');
  var p1y = new BigInteger(p1yhex, 16);
  var p1px = new ECFieldElementFp(ecparams.getCurve().getQ(), p1x);
  var p1py = new ECFieldElementFp(ecparams.getCurve().getQ(), p1y);
  var p1p = new ECPointFp(ecparams.getCurve(), p1px, p1py);

  var p = p1p.multiply(x);

  var point = new Point();
  var pointxbuf = new Buffer(p.getX().toBigInteger().toByteArrayUnsigned());
  point.x = bignum.fromBuffer(pointxbuf, {
    size: pointxbuf.length
  });
  assert(pointxbuf.length <= 32);
  var pointybuf = new Buffer(p.getY().toBigInteger().toByteArrayUnsigned());
  assert(pointybuf.length <= 32);
  point.y = bignum.fromBuffer(pointybuf, {
    size: pointybuf.length
  });

  return point;
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
