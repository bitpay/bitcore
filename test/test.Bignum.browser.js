var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = coinUtil || bitcore.util;
var should = chai.should();
var assert = chai.assert;

var Bignum = bitcore.Bignum;

if (typeof process == 'undefined' || typeof process.versions == 'undefined') {
  describe('Bignum.browser', function() {
    it.skip('should have proper config settings', function() {
      bitcore.Bignum.config().EXPONENTIAL_AT[0].should.equal(-9999999);
      bitcore.Bignum.config().EXPONENTIAL_AT[1].should.equal(9999999);
      bitcore.Bignum.config().DECIMAL_PLACES.should.equal(0);
      bitcore.Bignum.config().ROUNDING_MODE.should.equal(1);
    });
    it('should create a bignum', function() {
      var bn = new Bignum(50);
      should.exist(bn);
      bn.toString().should.equal('50');
    });

    it('should parse this number', function() {
      var bn = new Bignum(999970000);
      bn.toString().should.equal('999970000');
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

  });
}
