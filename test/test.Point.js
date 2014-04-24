'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');
var coinUtil = coinUtil || bitcore.util;
var buffertools = require('buffertools');
var bignum = require('bignum');

var should = chai.should();
var assert = chai.assert;

var Point = bitcore.Point;
var Key = bitcore.Key;

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

});
