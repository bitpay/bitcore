var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = coinUtil || bitcore.util;
var should = chai.should();
var assert = chai.assert;

var Bignum = bitcore.Bignum;

if (typeof process == 'undefined' || typeof process.versions == 'undefined') {
  describe('#Bignum.browser', function() {
    it('should have proper config settings', function() {
      bitcore.Bignum.config().EXPONENTIAL_AT[0].should.equal(-9999999);
      bitcore.Bignum.config().EXPONENTIAL_AT[1].should.equal(9999999);
      bitcore.Bignum.config().DECIMAL_PLACES.should.equal(0);
      bitcore.Bignum.config().ROUNDING_MODE.should.equal(1);
    });
  });
}
