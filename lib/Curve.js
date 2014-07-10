"use strict";
var bignum = require('bignum');
var Point = require('./Point');

var n = bignum.fromBuffer(new Buffer("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFEBAAEDCE6AF48A03BBFD25E8CD0364141", 'hex'), {
  size: 32
});


var Curve = function() {};

/* secp256k1 curve */
var G;
Curve.getG = function() {
  // don't use Point in top scope, causes exception in browser
  // when Point is not loaded yet

  // use cached version if available
  G = G || new Point(bignum.fromBuffer(new Buffer("79BE667EF9DCBBAC55A06295CE870B07029BFCDB2DCE28D959F2815B16F81798", 'hex'), {
      size: 32
    }),
    bignum.fromBuffer(new Buffer("483ADA7726A3C4655DA4FBFC0E1108A8FD17B448A68554199C47D08FFB10D4B8", 'hex'), {
      size: 32
    }));
  return G;
};

Curve.getN = function() {
  return n;
};

module.exports = require('soop')(Curve);
