var should = require('chai').should();
var Hash = require('../lib/hash');

describe('Hash', function() {
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

  describe('#sha256hmac', function() {
    
    it('should compute this known empty test vector correctly', function() {
      var key = new Buffer('');
      var data = new Buffer('');
      Hash.sha256hmac(data, key).toString('hex').should.equal('b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad');
    });

    it('should compute this known non-empty test vector correctly', function() {
      var key = new Buffer('key');
      var data = new Buffer('The quick brown fox jumps over the lazy dog');
      Hash.sha256hmac(data, key).toString('hex').should.equal('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
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

  describe("#sha512hmac", function() {

    it('should calculate this known empty test vector correctly', function() {
      var hex = 'b936cee86c9f87aa5d3c6f2e84cb5a4239a5fe50480a6ec66b70ab5b1f4ac6730c6c515421b327ec1d69402e53dfb49ad7381eb067b338fd7b0cb22247225d47';
      Hash.sha512hmac(new Buffer([]), new Buffer([])).toString('hex').should.equal(hex);
    });

    it('should calculate this known non-empty test vector correctly', function() {
      var hex = 'c40bd7c15aa493b309c940e08a73ffbd28b2e4cb729eb94480d727e4df577b13cc403a78e6150d83595f3b17c4cc331f12ca5952691de3735a63c1d4c69a2bac';
      var data = new Buffer("test1");
      var key = new Buffer("test2");
      Hash.sha512hmac(data, key).toString('hex').should.equal(hex);
    });

  });

});
