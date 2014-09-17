var BN = require('./bn');
var elliptic = require('elliptic');

var ec = elliptic.curves.secp256k1;
var ecpoint = ec.curve.point.bind(ec.curve)
var p = ec.curve.point();
var Curve = Object.getPrototypeOf(ec.curve);

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
  var n = BN(this._getX().toArray());
  return BN(this._getX().toArray());
};

Point.prototype._getY = Point.prototype.getY;
Point.prototype.getY = function() {
  return BN(this._getY().toArray());
};

//https://www.iacr.org/archive/pkc2003/25670211/25670211.pdf
Point.prototype.validate = function() {
  var p2 = Point.fromX(this.getY().isOdd(), this.getX());
  if (!(p2.y.cmp(this.y) === 0))
    throw new Error('Invalid y value of public key');
  if (!(this.getX().gt(-1) && this.getX().lt(Point.getN()))
    ||!(this.getY().gt(-1) && this.getY().lt(Point.getN())))
    throw new Error('Point does not lie on the curve');
  if (!(this.mul(Point.getN()).isInfinity()))
    throw new Error('Point times N must be infinity');
  return this;
};

module.exports = Point;
