var should = require('chai').should();
var Hash = require('../lib/hash');

describe('hash', function() {
  var buf = new Buffer([0, 1, 2, 3, 253, 254, 255]);
  var str = "test string";

  describe('#sha256', function() {

    it('should calculate the hash of this buffer correctly', function() {
      var hash = Hash.sha256(buf);
      hash.toString('hex').should.equal('6f2c7b22fd1626998287b3636089087961091de80311b9279c4033ec678a83e8');
    });

    it('should throw an error when the input is not a buffer', function() {
      (function() {
        Hash.sha256(str);
      }).should.throw('sha256 hash must be of a buffer');
    });

  });

  describe('#sha256sha256', function() {

    it('should calculate the hash of this buffer correctly', function() {
      var hash = Hash.sha256sha256(buf);
      hash.toString('hex').should.equal('be586c8b20dee549bdd66018c7a79e2b67bb88b7c7d428fa4c970976d2bec5ba');
    });

    it('should throw an error when the input is not a buffer', function() {
      (function() {
        Hash.sha256sha256(str);
      }).should.throw('sha256sha256 hash must be of a buffer');
    });

  });

  describe('#sha256ripemd160', function() {

    it('should calculate the hash of this buffer correctly', function() {
      var hash = Hash.sha256ripemd160(buf);
      hash.toString('hex').should.equal('7322e2bd8535e476c092934e16a6169ca9b707ec');
    });

    it('should throw an error when the input is not a buffer', function() {
      (function() {
        Hash.sha256ripemd160(str);
      }).should.throw('sha256ripemd160 hash must be of a buffer');
    });

  });

  describe('#ripemd160', function() {

    it('should calculate the hash of this buffer correctly', function() {
      var hash = Hash.ripemd160(buf);
      hash.toString('hex').should.equal('fa0f4565ff776fee0034c713cbf48b5ec06b7f5c');
    });

    it('should throw an error when the input is not a buffer', function() {
      (function() {
        Hash.ripemd160(str);
      }).should.throw('ripemd160 hash must be of a buffer');
    });

  });

  describe('#sha512', function() {

    it('should calculate the hash of this buffer correctly', function() {
      var hash = Hash.sha512(buf);
      hash.toString('hex').should.equal('c0530aa32048f4904ae162bc14b9eb535eab6c465e960130005feddb71613e7d62aea75f7d3333ba06e805fc8e45681454524e3f8050969fe5a5f7f2392e31d0');
    });

    it('should throw an error when the input is not a buffer', function() {
      (function() {
        Hash.sha512(str);
      }).should.throw('sha512 hash must be of a buffer');
    });

  });

});
