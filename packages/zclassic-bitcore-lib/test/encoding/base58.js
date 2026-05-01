'use strict';

var should = require('chai').should();
var bitcore = require('../..');
var buffer = require('buffer');
var Base58 = bitcore.encoding.Base58;

describe('Base58', function() {
  var buf = new buffer.Buffer([0, 1, 2, 3, 253, 254, 255]);
  var enc = '1W7N4RuG';

  it('should make an instance with "new"', function() {
    var b58 = new Base58();
    should.exist(b58);
  });

  it('validates characters with no false negatives', function() {
    Base58.validCharacters(
      '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz'
    ).should.equal(true);
  });
  it('validates characters from buffer', function() {
    Base58.validCharacters(
      new buffer.Buffer('123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz')
    ).should.equal(true);
  });

  it('some characters are invalid (no false positives)', function() {
    Base58.validCharacters('!@#%^$&*()\\').should.equal(false);
  });

  it('should make an instance without "new"', function() {
    var b58 = Base58();
    should.exist(b58);
  });

  it('should allow this handy syntax', function() {
    Base58(buf).toString().should.equal(enc);
    Base58(enc).toBuffer().toString('hex').should.equal(buf.toString('hex'));
  });

  describe('#set', function() {

    it('should set a blank buffer', function() {
      Base58().set({
        buf: new buffer.Buffer([])
      });
    });

  });

  describe('@encode', function() {

    it('should encode the buffer accurately', function() {
      Base58.encode(buf).should.equal(enc);
    });

    it('should throw an error when the Input is not a buffer', function() {
      (function() {
        Base58.encode('string');
      }).should.throw('Input should be a buffer');
    });

  });

  describe('@decode', function() {

    it('should decode this encoded value correctly', function() {
      Base58.decode(enc).toString('hex').should.equal(buf.toString('hex'));
    });

    it('should throw an error when Input is not a string', function() {
      (function() {
        Base58.decode(5);
      }).should.throw('Input should be a string');
    });

  });

  describe('#fromBuffer', function() {

    it('should not fail', function() {
      should.exist(Base58().fromBuffer(buf));
    });

    it('should set buffer', function() {
      var b58 = Base58().fromBuffer(buf);
      b58.buf.toString('hex').should.equal(buf.toString('hex'));
    });

  });

  describe('#fromString', function() {

    it('should convert this known string to a buffer', function() {
      Base58().fromString(enc).toBuffer().toString('hex').should.equal(buf.toString('hex'));
    });

  });

  describe('#toBuffer', function() {

    it('should return the buffer', function() {
      var b58 = Base58({
        buf: buf
      });
      b58.buf.toString('hex').should.equal(buf.toString('hex'));
    });

  });

  describe('#toString', function() {

    it('should return the buffer', function() {
      var b58 = Base58({
        buf: buf
      });
      b58.toString().should.equal(enc);
    });

  });

});
