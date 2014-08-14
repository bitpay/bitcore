var should = require('chai').should();
var base58check = require('../lib/base58check');
var base58 = require('../lib/base58');

describe('Base58check', function() {
  var buf = new Buffer([0, 1, 2, 3, 253, 254, 255]);
  var enc = "14HV44ipwoaqfg";

  describe('#encode', function() {

    it('should encode the buffer accurately', function() {
      base58check.encode(buf).should.equal(enc);
    });

    it('should throw an error when the input is not a buffer', function() {
      (function() {
        base58check.encode("string")
      }).should.throw('base58check: Input must be a buffer');
    });

  });

  describe('#decode', function() {

    it('should decode this encoded value correctly', function() {
      base58check.decode(enc).toString('hex').should.equal(buf.toString('hex'));
    });

    it('should throw an error when input is not a string', function() {
      (function() {
        base58check.decode(5);
      }).should.throw('base58check: Input must be a string');
    });

    it('should throw an error when input is too short', function() {
      (function() {
        base58check.decode(enc.slice(0, 1));
      }).should.throw('base58check: Input string too short');
    });

    it('should throw an error when there is a checksum mismatch', function() {
      var buf2 = base58.decode(enc);
      buf2[0] = buf2[0] + 1;
      var enc2 = base58.encode(buf2);
      (function() {
        base58check.decode(enc2);
      }).should.throw('base58check: Checksum mismatch');
    });

  });

});
