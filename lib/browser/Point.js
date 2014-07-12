"use strict";

var Key = require('./Key');
var bignum = require('bignum');
var assert = require('assert');
var elliptic = require('elliptic');
var Point = require('../common/Point');

Point.add = function(p1, p2) {
  var ec = elliptic.curves.secp256k1;
  var ecp1 = ec.curve.point(p1.x, p1.y);
  var ecp2 = ec.curve.point(p2.x, p2.y);
  var ecp3 = ecp1.add(ecp2);
  //var p3 = ec.curve.point(ecp3.x, ecp3.y);
  var p3 = new Point(ecp3.x, ecp3.y);
  return p3;
};

Point.multiply = function(p1, x) {
  if (Buffer.isBuffer(x) && x.length !== 32)
    throw new Error('if x is a buffer, it must be 32 bytes')
  var ec = elliptic.curves.secp256k1;
  var ecp1 = ec.curve.point(p1.x, p1.y);
  if (typeof x === 'string')
    x = new bignum(x);
  var ecp = ecp1.mul(x);
  var p = new Point(ecp.x, ecp.y);
  return p;
};

module.exports = Point;
