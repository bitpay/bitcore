'use strict';

var _ = require('lodash');
var chai = require('chai');
var sinon = require('sinon');
var should = chai.should();
var x = require('../ts_build/lib/xpiaddresstranslator');

describe('XPI Address translator', function() {

  describe('#getAddressCoin', function() {
    it('should identify xpi as coin for lotus_16PSJLk9W86KAZp26x3uM176w6N9vUU8YNQQnQTHN', function() {
      x.getAddressCoin('lotus_16PSJLk9W86KAZp26x3uM176w6N9vUU8YNQQnQTHN').should.equal('xaddr');
    });
    it('should identify bch as coin for lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs', function() {
      x.getAddressCoin('lotus_16PSJPLVnkMvbURPjfPGZqdrUhzwYJSAxJiXVcfKs').should.equal('xaddr');
    });
    it('should return null for 1L', function() {
      should.not.exist(x.getAddressCoin('1L'));
    });
  });


  describe('#translateAddress', function() {
    it('should translate address from xpi to bch', function() {
      var res = x.translate('lotus_16PSJLk9W86KAZp26x3uM176w6N9vUU8YNQQnQTHN', 'copay');
      res.should.equal('CTH8H8Zj6DSnXFBKQeDG28ogAS92iS16Bp');
    });
    it('should translate address from xpi to bcha', function() {
      var res = x.translate('lotus_16PSJLk9W86KAZp26x3uM176w6N9vUU8YNQQnQTHN', 'cashaddr');
      res.should.equal('qpm2qsznhks23z7629mms6s4cwef74vcwvy22gdx6a');
    });
    it('should translate address from xpi to legacy', function() {
      var res = x.translate('lotus_16PSJLk9W86KAZp26x3uM176w6N9vUU8YNQQnQTHN', 'legacy');
      res.should.equal('1BpEi6DfDAUFd7GtittLSdBeYJvcoaVggu');
    });
    it('should translate address from bch to xpi', function() {
      var res = x.translate('HBf8isgS8EXG1r3X6GP89FmooUmiJ42wHS', 'xaddr');
      res.should.equal('lotus_1PrQZ2Fyqta5KAqgPBXf9mJZ8bsoXuX2tJqsVx');
    });
    it('should keep the address if there is nothing to do (xpi)', function() {
      var res = x.translate('lotus_16PSJH9TW2pmsvYLZYMLuASKMuzHk8p7FYaka2pzR', 'xaddr');
      res.should.equal('lotus_16PSJH9TW2pmsvYLZYMLuASKMuzHk8p7FYaka2pzR');
    });
    it('should filter out broken addreseses', function() {
      var res = x.translate(['lotus_1PrRa971yGQAkFgANnGrixhXuZTFhGfkBFL2og','pepe', 123,'lotus_1PrQAo6rZSfDwo8R6V8YnEkyjShiWqMuE6M6GV', 'false' ], 'copay');
      res.should.deep.equal(['HR3ytsYEpS6XXkWskgfkccqLVPeGdXQ1S8','H6d4PZ12phrMcu4LRDKNjq3QDiaMDz3fUd']);
    });
  });
});

