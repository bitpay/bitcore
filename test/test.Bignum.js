var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = coinUtil || bitcore.util;
var should = chai.should();
var assert = chai.assert;

var Bignum = bitcore.Bignum;

describe('Bignum', function() {
  it('should create a bignum', function() {
    var bn = new Bignum(50);
    should.exist(bn);
    bn.toString().should.equal('50');
  });

  it('should parse this number', function() {
    var bn = new Bignum(999970000);
    bn.toString().should.equal('999970000');
  });

  it('should parse numbers below and at bn.js internal word size', function() {
    var bn = new Bignum(Math.pow(2, 26) - 1);
    bn.toString().should.equal((Math.pow(2, 26) - 1).toString());
    var bn = new Bignum(Math.pow(2, 26));
    bn.toString().should.equal((Math.pow(2, 26)).toString());
  });
  
  describe('#add', function() {

    it('should add two small numbers together', function() {
      var bn1 = new Bignum(50);
      var bn2 = new Bignum(75);
      var bn3 = bn1.add(bn2);
      bn3.toString().should.equal('125');
    });

  });

  describe('#sub', function() {

    it('should subtract a small number', function() {
      var bn1 = new Bignum(50);
      var bn2 = new Bignum(25);
      var bn3 = bn1.sub(bn2);
      bn3.toString().should.equal('25');
    });

  });

  describe('#gt', function() {

    it('should say 1 is greater than 0', function() {
      var bn1 = new Bignum(1);
      var bn0 = new Bignum(0);
      bn1.gt(bn0).should.equal(true);
    });

    it('should say a big number is greater than a small big number', function() {
      var bn1 = new Bignum('24023452345398529485723980457');
      var bn0 = new Bignum('34098234283412341234049357');
      bn1.gt(bn0).should.equal(true);
    });

    it('should say a big number is great than a standard number', function() {
      var bn1 = new Bignum('24023452345398529485723980457');
      var bn0 = new Bignum(5);
      bn1.gt(bn0).should.equal(true);
    });

  });

  describe('#fromBuffer', function() {
    
    it('should work with big endian', function() {
      var bn = Bignum.fromBuffer(new Buffer('0001', 'hex'), {endian: 'big'});
      bn.toString().should.equal('1');
    });

    it('should work with big endian 256', function() {
      var bn = Bignum.fromBuffer(new Buffer('0100', 'hex'), {endian: 'big'});
      bn.toString().should.equal('256');
    });

    it('should work with little endian if we specify the size', function() {
      var bn = Bignum.fromBuffer(new Buffer('0100', 'hex'), {size: 2, endian: 'little'});
      bn.toString().should.equal('1');
    });

  });

  describe('#toBuffer', function() {
    
    it('should create a 4 byte buffer', function() {
      var bn = new Bignum(1);
      bn.toBuffer({size: 4}).toString('hex').should.equal('00000001');
    });

    it('should create a 4 byte buffer in little endian', function() {
      var bn = new Bignum(1);
      bn.toBuffer({size: 4, endian: 'little'}).toString('hex').should.equal('01000000');
    });

    it('should create a 2 byte buffer even if you ask for a 1 byte', function() {
      var bn = new Bignum('ff00', 16);
      bn.toBuffer({size: 1}).toString('hex').should.equal('ff00');
    });

    it('should create a 4 byte buffer even if you ask for a 1 byte', function() {
      var bn = new Bignum('ffffff00', 16);
      bn.toBuffer({size: 4}).toString('hex').should.equal('ffffff00');
    });

  });

});
