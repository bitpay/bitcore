'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = coinUtil || bitcore.util;
var buffertools = require('buffertools');
var bignum = bitcore.Bignum;

var should = chai.should();
var assert = chai.assert;

var Curve = bitcore.Curve;

describe('Curve', function() {

  it('should initialize the main object', function() {
    should.exist(Curve);
  });

  describe('getN', function() {
    it('should return a big number', function() {
      var N = Curve.getN();
      should.exist(N);
      N.toBuffer({size: 32}).toString('hex').length.should.equal(64);
    });
  });

  describe('getG', function() {
    it('should return a Point', function() {
      var G = Curve.getG();
      should.exist(G.x);
      G.x.toBuffer({size: 32}).toString('hex').length.should.equal(64);
      G.y.toBuffer({size: 32}).toString('hex').length.should.equal(64);
    });
  });

});
