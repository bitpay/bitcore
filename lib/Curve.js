"use strict";
var imports = require('soop');
var bignum = imports.bignum || require('bignum');
var Point = imports.Point || require('./Point');

var n = bignum.fromBuffer(new Buffer("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 'hex'), {size: 32});
var G = new Point(bignum.fromBuffer(new Buffer("79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798", 'hex'), {size: 32}),
                  bignum.fromBuffer(new Buffer("483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8", 'hex'), {size: 32}));

/* secp256k1 curve */
var Curve = function() {
};

Curve.getG = function() {
  return G;
};

Curve.getN = function() {
  return n;
};

module.exports = require('soop')(Curve);
