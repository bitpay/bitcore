'use strict';

var BN = require('./bn');
var elliptic = require('elliptic');

var ec = elliptic.curves.secp256k1;
var ecpoint = ec.curve.point.bind(ec.curve);
var p = ec.curve.point();

var bufferUtil = require('../util/buffer');

var Point = function Point(x, y, isRed) {
  return ecpoint(x, y, isRed);
};

Point.prototype = Object.getPrototypeOf(p);

Point.fromX = ec.curve.pointFromX.bind(ec.curve);

Point.getG = function() {
  var p = Point(ec.curve.g.getX(), ec.curve.g.getY());
  return p;
};

Point.getN = function() {
  return BN(ec.curve.n.toArray());
};

Point.prototype._getX = Point.prototype.getX;
Point.prototype.getX = function() {
  return BN(this._getX().toArray());
};

Point.prototype._getY = Point.prototype.getY;
Point.prototype.getY = function() {
  return BN(this._getY().toArray());
};

//https://www.iacr.org/archive/pkc2003/25670211/25670211.pdf
Point.prototype.validate = function() {
  /* jshint maxcomplexity: 8 */
  var p2 = Point.fromX(this.getY().isOdd(), this.getX());
  if (p2.y.cmp(this.y) !== 0) {
    throw new Error('Invalid y value of public key');
  }
  var xValidRange = (this.getX().gt(-1) && this.getX().lt(Point.getN()));
  var yValidRange = (this.getY().gt(-1) && this.getY().lt(Point.getN()));
  if (!(xValidRange && yValidRange)) {
    throw new Error('Point does not lie on the curve');
  }
  if (!(this.mul(Point.getN()).isInfinity())) {
    throw new Error('Point times N must be infinity');
  }
  return this;
};

Point.pointToCompressed = function pointToCompressed(point) {
  var xbuf = point.getX().toBuffer({size: 32});
  var ybuf = point.getY().toBuffer({size: 32});

  var prefix;
  var odd = ybuf[ybuf.length - 1] % 2;
  if (odd) {
    prefix = new Buffer([0x03]);
  } else {
    prefix = new Buffer([0x02]);
  }
  return bufferUtil.concat([prefix, xbuf]);
};

module.exports = Point;
