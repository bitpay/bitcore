'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var should = chai.should();

var bignum = bitcore.bignum;
var base58 = bitcore.base58;
var base58Check = base58.base58Check;

describe('Miscelaneous stuff', function() {
  it('should initialze the config object', function() {
    should.exist(bitcore.config);
  });
  it('should initialze the log object', function() {
    should.exist(bitcore.log);
  });
  it('should initialze the util object', function() {
    should.exist(bitcore.util);
  });
  it('should initialze the const object', function() {
    should.exist(bitcore.const);
  });


  // bignum
  it('should initialze the bignum object', function() {
    should.exist(bitcore.bignum);
  });
  it('should create a bignum from string', function() {
    var n = bignum('9832087987979879879879879879879879879879879879');
    should.exist(n);
  });
  it('should perform basic math operations for bignum', function() {
    var b = bignum('782910138827292261791972728324982')
    .sub('182373273283402171237474774728373')
    .div(13);
    b.toNumber().should.equal(46195143503376160811884457968969);
  });

  // base58
  it('should initialze the base58 object', function() {
    should.exist(bitcore.base58);
  });
  it('should obtain the same string in base58 roundtrip', function() {
    var m = 'mqqa8xSMVDyf9QxihGnPtap6Mh6qemUkcu';
    base58.encode(base58.decode(m)).should.equal(m);
  });
  it('should obtain the same string in base58Check roundtrip', function() {
    var m = '1QCJj1gPZKx2EwzGo9Ri8mMBs39STvDYcv';
    base58Check.encode(base58Check.decode(m)).should.equal(m);
  });

});






