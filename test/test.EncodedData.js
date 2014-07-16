'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

var should = chai.should();

var EncodedData = bitcore.EncodedData;

describe('EncodedData', function() {

  it('should initialize the main object', function() {
    should.exist(EncodedData);
  });

  it('should be able to create an instance', function() {
    var ed = new EncodedData('1GMx4HdDmN78xzGvdQYkwrVqkmLDG1aMNT');
    should.exist(ed);
  });

  describe('#as', function() {
    var buf = bitcore.util.sha256('test');
    var hex = buf.toString('hex');
    var b58 = '2DFtpKRbW2nfrzgAgE25onW3vwCQwM7S1iHk34LW9cwH1kzmHp';
    
    it('should convert from binary -> base58', function() {
      var ed = new EncodedData(buf);
      ed.as('base58').should.equal(bitcore.Base58.base58Check.encode(buf));
    });

    it('should convert from binary -> hex', function() {
      var ed = new EncodedData(buf);
      ed.as('hex').should.equal(hex);
    });

    it('should convert from base58 -> binary', function() {
      var ed = new EncodedData(b58);
      ed.as('binary').toString('hex').should.equal(hex);
    });

    it('should convert from base58 -> hex', function() {
      var ed = new EncodedData(b58);
      ed.as('hex').should.equal(hex);
    });

    it('should convert from hex -> binary', function() {
      var ed = new EncodedData(hex, 'hex');
      ed.as('binary').toString('hex').should.equal(hex);
    });

    it('should convert from hex -> base58', function() {
      var ed = new EncodedData(hex, 'hex');
      ed.as('base58').should.equal(b58);
    });

  });

});





