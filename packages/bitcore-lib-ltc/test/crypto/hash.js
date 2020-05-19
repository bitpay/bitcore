'use strict';

require('chai').should();
var bitcore = require('../..');
var Hash = bitcore.crypto.Hash;

describe('Hash', function() {
  var buf = new Buffer([0, 1, 2, 3, 253, 254, 255]);
  var str = 'test string';

  describe('@sha1', function() {

    it('calculates the hash of this buffer correctly', function() {
      var hash = Hash.sha1(buf);
      hash.toString('hex').should.equal('de69b8a4a5604d0486e6420db81e39eb464a17b2');
      hash = Hash.sha1(new Buffer(0));
      hash.toString('hex').should.equal('da39a3ee5e6b4b0d3255bfef95601890afd80709');
    });

    it('throws an error when the input is not a buffer', function() {
      Hash.sha1.bind(Hash, str).should.throw('Invalid Argument');
    });

  });

  describe('#sha256', function() {

    it('calculates the hash of this buffer correctly', function() {
      var hash = Hash.sha256(buf);
      hash.toString('hex').should.equal('6f2c7b22fd1626998287b3636089087961091de80311b9279c4033ec678a83e8');
    });

    it('fails when the input is not a buffer', function() {
      Hash.sha256.bind(Hash, str).should.throw('Invalid Argument');
    });

  });

  describe('#sha256hmac', function() {

    it('computes this known big key correctly', function() {
      var key = new Buffer('b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad' +
        'b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad' +
        'b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad' +
        'b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad');
      var data = new Buffer('');
      Hash.sha256hmac(data, key).toString('hex')
        .should.equal('fb1f87218671f1c0c4593a88498e02b6dfe8afd814c1729e89a1f1f6600faa23');
    });

    it('computes this known empty test vector correctly', function() {
      var key = new Buffer('');
      var data = new Buffer('');
      Hash.sha256hmac(data, key).toString('hex')
        .should.equal('b613679a0814d9ec772f95d778c35fc5ff1697c493715653c6c712144292c5ad');
    });

    it('computes this known non-empty test vector correctly', function() {
      var key = new Buffer('key');
      var data = new Buffer('The quick brown fox jumps over the lazy dog');
      Hash.sha256hmac(data, key).toString('hex')
        .should.equal('f7bc83f430538424b13298e6aa6fb143ef4d59a14946175997479dbc2d1a3cd8');
    });

  });

  describe('#sha256sha256', function() {

    it('calculates the hash of this buffer correctly', function() {
      var hash = Hash.sha256sha256(buf);
      hash.toString('hex').should.equal('be586c8b20dee549bdd66018c7a79e2b67bb88b7c7d428fa4c970976d2bec5ba');
    });

    it('fails when the input is not a buffer', function() {
      Hash.sha256sha256.bind(Hash, str).should.throw('Invalid Argument');
    });

  });

  describe('#sha256ripemd160', function() {

    it('calculates the hash of this buffer correctly', function() {
      var hash = Hash.sha256ripemd160(buf);
      hash.toString('hex').should.equal('7322e2bd8535e476c092934e16a6169ca9b707ec');
    });

    it('fails when the input is not a buffer', function() {
      Hash.sha256ripemd160.bind(Hash, str).should.throw('Invalid Argument');
    });

  });

  describe('#ripemd160', function() {

    it('calculates the hash of this buffer correctly', function() {
      var hash = Hash.ripemd160(buf);
      hash.toString('hex').should.equal('fa0f4565ff776fee0034c713cbf48b5ec06b7f5c');
    });

    it('fails when the input is not a buffer', function() {
      Hash.ripemd160.bind(Hash, str).should.throw('Invalid Argument');
    });

  });

  describe('#sha512', function() {

    it('calculates the hash of this buffer correctly', function() {
      var hash = Hash.sha512(buf);
      hash.toString('hex')
        .should.equal('c0530aa32048f4904ae162bc14b9eb535eab6c465e960130005fedd' +
          'b71613e7d62aea75f7d3333ba06e805fc8e45681454524e3f8050969fe5a5f7f2392e31d0');
    });

    it('fails when the input is not a buffer', function() {
      Hash.sha512.bind(Hash, str).should.throw('Invalid Argument');
    });

  });

  describe('#sha512hmac', function() {

    it('calculates this known empty test vector correctly', function() {
      var hex = 'b936cee86c9f87aa5d3c6f2e84cb5a4239a5fe50480a6ec66b70ab5b1f4a' +
        'c6730c6c515421b327ec1d69402e53dfb49ad7381eb067b338fd7b0cb22247225d47';
      Hash.sha512hmac(new Buffer([]), new Buffer([])).toString('hex').should.equal(hex);
    });

    it('calculates this known non-empty test vector correctly', function() {
      var hex = 'c40bd7c15aa493b309c940e08a73ffbd28b2e4cb729eb94480d727e4df577' +
        'b13cc403a78e6150d83595f3b17c4cc331f12ca5952691de3735a63c1d4c69a2bac';
      var data = new Buffer('test1');
      var key = new Buffer('test2');
      Hash.sha512hmac(data, key).toString('hex').should.equal(hex);
    });

  });

  describe('#scrypt', function() {

    // See: https://github.com/litecoin-project/litecoin/blob/master-0.10/src/test/scrypt_tests.cpp
    it('calculates scrypt hash correctly', function() {
      var headers = [ "020000004c1271c211717198227392b029a64a7971931d351b387bb80db027f270411e398a07046f7d4a08dd815412a8712f874a7ebf0507e3878bd24e20a3b73fd750a667d2f451eac7471b00de6659", "0200000011503ee6a855e900c00cfdd98f5f55fffeaee9b6bf55bea9b852d9de2ce35828e204eef76acfd36949ae56d1fbe81c1ac9c0209e6331ad56414f9072506a77f8c6faf551eac7471b00389d01", "02000000a72c8a177f523946f42f22c3e86b8023221b4105e8007e59e81f6beb013e29aaf635295cb9ac966213fb56e046dc71df5b3f7f67ceaeab24038e743f883aff1aaafaf551eac7471b0166249b", "010000007824bc3a8a1b4628485eee3024abd8626721f7f870f8ad4d2f33a27155167f6a4009d1285049603888fe85a84b6c803a53305a8d497965a5e896e1a00568359589faf551eac7471b0065434e", "0200000050bfd4e4a307a8cb6ef4aef69abc5c0f2d579648bd80d7733e1ccc3fbc90ed664a7f74006cb11bde87785f229ecd366c2d4e44432832580e0608c579e4cb76f383f7f551eac7471b00c36982" ];
      var hashes = [ "00000000002bef4107f882f6115e0b01f348d21195dacd3582aa2dabd7985806" , "00000000003a0d11bdd5eb634e08b7feddcfbbf228ed35d250daf19f1c88fc94", "00000000000b40f895f288e13244728a6c2d9d59d8aff29c65f8dd5114a8ca81", "00000000003007005891cd4923031e99d8e8d72f6e8e7edc6a86181897e105fe", "000000000018f0b426a4afc7130ccb47fa02af730d345b4fe7c7724d3800ec8c" ];

      headers.forEach(function(header, i) {
        var data = new Buffer(header, 'hex');
        Hash.scrypt(data).toString('hex').should.equal(hashes[i]);
      });
    });

  });

});
