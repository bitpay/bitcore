var bn = require('./bn');
var elliptic = require('elliptic');

var ec = elliptic.curves.secp256k1;
var Point = ec.curve.point.bind(ec.curve)
var p = ec.curve.point();
var Curve = Object.getPrototypeOf(ec.curve);
Point.prototype = Object.getPrototypeOf(p);

Point.pointFromX = ec.curve.pointFromX.bind(ec.curve);

Point.getG = function() {
  var p = Point(ec.curve.g.getX(), ec.curve.g.getY());
  return p;
};

Point.getN = function() {
  return bn(ec.curve.n.toArray());
};

Point.prototype._getX = Point.prototype.getX;
Point.prototype.getX = function() {
  var n = bn(this._getX().toArray());
  return bn(this._getX().toArray());
};

Point.prototype._getY = Point.prototype.getY;
Point.prototype.getY = function() {
  return bn(this._getY().toArray());
};

module.exports = Point;
