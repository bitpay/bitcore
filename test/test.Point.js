'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = coinUtil || bitcore.util;
var buffertools = require('buffertools');
var bignum = bitcore.Bignum;

var should = chai.should();
var assert = chai.assert;

var Point = bitcore.Point;
var Key = bitcore.Key;

var testdata = testdata || require('./testdata');

describe('Point', function() {

  it('should initialize the main object', function() {
    should.exist(Point);
  });

  it('should be able to create instance', function() {
    var p = new Point();
    should.exist(p);
  });

  it('should add these two points correctly', function() {
    //these points are from one of the BIP32 test vectors
    var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
    var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
    var a = new Point(bignum.fromBuffer((new Buffer(axhex, 'hex')), {size: 32}), bignum.fromBuffer((new Buffer(ayhex, 'hex')), {size: 32}));
    var bxhex = "5a784662a4a20a65bf6aab9ae98a6c068a81c52e4b032c0fb5400c706cfccc56";
    var byhex = "7f717885be239daadce76b568958305183ad616ff74ed4dc219a74c26d35f839";
    var b = new Point(bignum.fromBuffer((new Buffer(bxhex, 'hex')), {size: 32}), bignum.fromBuffer((new Buffer(byhex, 'hex')), {size: 32}));
    var sxhex = "501e454bf00751f24b1b489aa925215d66af2234e3891c3b21a52bedb3cd711c";
    var syhex = "008794c1df8131b9ad1e1359965b3f3ee2feef0866be693729772be14be881ab";
    var s = new Point(bignum.fromBuffer((new Buffer(sxhex, 'hex')), {size: 32}), bignum.fromBuffer((new Buffer(syhex, 'hex')), {size: 32}));
    var sum = Point.add(a, b);
    s.x.toBuffer({size: 32}).toString('hex').should.equal(sum.x.toBuffer({size: 32}).toString('hex'));
    s.y.toBuffer({size: 32}).toString('hex').should.equal(sum.y.toBuffer({size: 32}).toString('hex'));
  });

  it('should convert a Point into the public key of a Key', function() {
    var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
    var axbuf = new Buffer(axhex, 'hex');
    var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
    var aybuf = new Buffer(ayhex, 'hex');
    var a = new Point(bignum.fromBuffer(axbuf, {size: 32}), bignum.fromBuffer(aybuf, {size: 32}));

    var pubKeyBufCompressedHex = "0369b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
    var key = new Key();
    key.public = new Buffer(pubKeyBufCompressedHex, 'hex');
    key.compressed = false;

    key.public.toString('hex').should.equal(a.toUncompressedPubKey().toString('hex'));
  });

  it('should convert the public key of a Key into a Point', function() {
    var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
    var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";

    var pubKeyBufCompressedHex = "0369b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
    var key = new Key();
    key.public = new Buffer(pubKeyBufCompressedHex, 'hex');
    key.compressed = false;

    var point = Point.fromUncompressedPubKey(key.public);
    point.x.toBuffer({size: 32}).toString('hex').should.equal(axhex);
    point.y.toBuffer({size: 32}).toString('hex').should.equal(ayhex);
  });

  describe('#multiply', function() {

    it('should multiply this number by 2', function() {
      var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
      var axbuf = new Buffer(axhex, 'hex');
      var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
      var aybuf = new Buffer(ayhex, 'hex');
      var a = new Point(bignum.fromBuffer(axbuf, {size: 32}), bignum.fromBuffer(aybuf, {size: 32}));

      var x = new bignum(2);
      var xbuf = x.toBuffer({size: 32});
      var mult = Point.multiply(a, xbuf);
      mult.x.toBuffer({size: 32}).toString('hex').should.equal('f81b3dcae4eeb504d2898500721ece357767b9564bdf03dce95a3db12de72d3a');
      mult.y.toBuffer({size: 32}).toString('hex').should.equal('e0220ac6e8524ca3f80c2c65a390dacc0371a6875afc8546d621eb20284e5568');
    });

    it('should fail if x < 32 bytes', function() {
      var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
      var axbuf = new Buffer(axhex, 'hex');
      var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
      var aybuf = new Buffer(ayhex, 'hex');
      var a = new Point(bignum.fromBuffer(axbuf, {size: 32}), bignum.fromBuffer(aybuf, {size: 32}));

      var x = new Buffer(31);
      x.fill(0);
      (function() {Point.multiply(a, x);}).should.throw('if x is a buffer, it must be 32 bytes');
    });

    it('should fail if x > 32 bytes', function() {
      var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
      var axbuf = new Buffer(axhex, 'hex');
      var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
      var aybuf = new Buffer(ayhex, 'hex');
      var a = new Point(bignum.fromBuffer(axbuf, {size: 32}), bignum.fromBuffer(aybuf, {size: 32}));

      var x = new Buffer(33);
      x.fill(0);
      (function() {Point.multiply(a, x);}).should.throw('if x is a buffer, it must be 32 bytes');
    });

    it('should multiply this number by 200 (buffer)', function() {
      var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
      var axbuf = new Buffer(axhex, 'hex');
      var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
      var aybuf = new Buffer(ayhex, 'hex');
      var a = new Point(bignum.fromBuffer(axbuf, {size: 32}), bignum.fromBuffer(aybuf, {size: 32}));

      var x = new bignum(200);
      var xbuf = x.toBuffer({size: 32});
      var mult = Point.multiply(a, xbuf);
      mult.x.toBuffer({size: 32}).toString('hex').should.equal('91c03d9104df24f01d69702c680a53a9b46ba49de89ab27819ea02c61229bace');
      mult.y.toBuffer({size: 32}).toString('hex').should.equal('5d2fdbdeab06383f14b2702e893444be5e80af58cecb9a70c1ae22e9daab69c1');
    });

    it('should multiply this number by 200 (number)', function() {
      var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
      var axbuf = new Buffer(axhex, 'hex');
      var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
      var aybuf = new Buffer(ayhex, 'hex');
      var a = new Point(bignum.fromBuffer(axbuf, {size: 32}), bignum.fromBuffer(aybuf, {size: 32}));

      var mult = Point.multiply(a, 200);
      mult.x.toBuffer({size: 32}).toString('hex').should.equal('91c03d9104df24f01d69702c680a53a9b46ba49de89ab27819ea02c61229bace');
      mult.y.toBuffer({size: 32}).toString('hex').should.equal('5d2fdbdeab06383f14b2702e893444be5e80af58cecb9a70c1ae22e9daab69c1');
    });

    it('should multiply this number by 200 (string)', function() {
      var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
      var axbuf = new Buffer(axhex, 'hex');
      var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
      var aybuf = new Buffer(ayhex, 'hex');
      var a = new Point(bignum.fromBuffer(axbuf, {size: 32}), bignum.fromBuffer(aybuf, {size: 32}));

      var mult = Point.multiply(a, '200');
      mult.x.toBuffer({size: 32}).toString('hex').should.equal('91c03d9104df24f01d69702c680a53a9b46ba49de89ab27819ea02c61229bace');
      mult.y.toBuffer({size: 32}).toString('hex').should.equal('5d2fdbdeab06383f14b2702e893444be5e80af58cecb9a70c1ae22e9daab69c1');
    });

    it('should multiply this point by big number', function() {
      var axhex = "69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d";
      var axbuf = new Buffer(axhex, 'hex');
      var ayhex = "eeedc91342b3c8982c1e676435780fe5f9d62f3f692e8d1512485d77fab35997";
      var aybuf = new Buffer(ayhex, 'hex');
      var a = new Point(bignum.fromBuffer(axbuf, {size: 32}), bignum.fromBuffer(aybuf, {size: 32}));

      var x = new bignum('69b154b42ff9452c31251cb341d7db01ad603dc56d64f9c5fb9e7031b89a241d', 16);
      var xbuf = x.toBuffer({size: 32});
      var mult = Point.multiply(a, xbuf);
      mult.x.toBuffer().toString('hex').should.equal('cdc09cfe61eb6a6a3de87feb4a001e82396142c5201d50b5284ac04c1969daa5');
      mult.y.toBuffer().toString('hex').should.equal('405813e7942e25cadefa653baf4230fc009a461b5ead16ed1f5fd80c9ea13c02');
    });

  });

  describe('#toCompressedPubKey', function() {
    
    it('should handle an odd y', function() {
      var p = new Point();
      p.x = new bignum('e22d4eeedc02d79c00a8daba5f01c9a5a129ae028fa689328121d226fa9398b7', 16);
      p.y = new bignum('3c4c880a28da79270e62901277c0ab122158aea8630e7c0bcb691adb3abfd33d', 16);
      p.toCompressedPubKey().toString('hex').should.equal('03e22d4eeedc02d79c00a8daba5f01c9a5a129ae028fa689328121d226fa9398b7');
    });

    it('should handle an even y', function() {
      var p = new Point();
      p.x = new bignum('8078d90f1ec3ac0a3ec1d2184939a8ed675eec5008d585132ba75465429ec0eb', 16);
      p.y = new bignum('32a389053fd408577bb7cdf8bbd4c58a3eca5af74a304de7510c9b3ffdaca17a', 16);
      p.toCompressedPubKey().toString('hex').should.equal('028078d90f1ec3ac0a3ec1d2184939a8ed675eec5008d585132ba75465429ec0eb');
    });

  });

  describe('secp256k1 test vectors', function() {
    //test vectors from http://crypto.stackexchange.com/questions/784/are-there-any-secp256k1-ecdsa-test-examples-available
    var G = Point.getG();
    testdata.dataSecp256k1.nTimesG.forEach(function(val) {
      it('should multiply n by G and get p from test data', function() {
        var n = new Buffer(val.n, 'hex');
        var p = Point.multiply(G, n);
        p.x.toBuffer().toString('hex').toUpperCase().should.equal(val.px);
        p.y.toBuffer().toString('hex').toUpperCase().should.equal(val.py);
      });
    });
  });

});
