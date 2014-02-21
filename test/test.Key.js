'use strict';

var chai = require('chai');
var bitcore = require('../bitcore');

var buffertools = require('buffertools');

var should = chai.should();

var KeyModule = bitcore.KeyModule;
var Key;
describe('Key', function() {
  it('should initialze the main object', function() {
    should.exist(KeyModule);
  });
  it('should be able to create class', function() {
    Key = KeyModule.Key;
    should.exist(Key);
  });
  it('should be able to create instance', function() {
    var k = new Key();
    should.exist(k);
  });
  it('should be able to generateSync instance', function() {
    var k = Key.generateSync();
    should.exist(k);
    (k instanceof Key).should.be.ok;
  });
  it('should retain some basic properties', function() {
    var k = Key.generateSync();
    should.exist(k.private);
    should.exist(k.public);
    should.exist(k.compressed);
  });
  it('should have a valid public key', function() {
    var k = Key.generateSync();
    k.compressed.should.be.ok;
    k.public.length.should.equal(33);
    k.public[0].should.be.above(1);
    k.public[0].should.be.below(4);
  });
  it('should have a valid private key', function() {
    var k = Key.generateSync();
    k.private.length.should.equal(32);
  });

  it('should be able to regenerate from a private key', function() {
    var k = Key.generateSync();
    var pkshex = 'b7dafe35d7d1aab78b53982c8ba554584518f86d50af565c98e053613c8f15e0';
    var pubhex = '02211c9570d24ba84a3ee31c8a08e93a6756b3f3beac76a4ab8d9748ca78203389';
    k.private = buffertools.fromHex(new Buffer(pkshex));
    k.regenerateSync();
    k.compressed.should.be.ok;
    buffertools.toHex(k.private).should.equal(pkshex);
    buffertools.toHex(k.public).should.equal(pubhex);
  });



});
