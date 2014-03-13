'use strict';

var chai = chai || require('chai');
var bitcore = bitcore || require('../bitcore');

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
  Key = KeyModule.Key;
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
    k.private.length.should.be.below(33);
    k.private.length.should.be.above(30);
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
  it('should generate a hardcoded public key example', function() {
    var k = new Key();
    k.private = new Buffer('876156ccb16bb1760ddda6ad3e561c026fc0d679ad7860b71dd11c30e42f6589','hex');
    k.regenerateSync();

    k.compressed.should.equal(true);
    var pHex = bitcore.buffertools.toHex(k.public);
    pHex.should.equal('0394615227fd5ff4d4dfac88cf148e43d35a7a059788dd2479f60cea807b09d0c2');
  });

  it('should not fail checking good signSync status', function() {
    var k = Key.generateSync();
    var b = new Buffer(32);
    k.signSync.bind(k,b).should.not.Throw(Error);
  });
  it('should fail checking bad signSync params', function() {
    var k = Key.generateSync();
    k.signSync.bind(k,'1').should.Throw(Error);
    k.signSync.bind(k,new Buffer(10)).should.Throw(Error);
    k.signSync.bind(k,new Buffer(32)).should.not.Throw(Error);
  });

  var a_hash = buffertools.fromHex(new Buffer('1122334455667788990011223344556677889900112233445566778899001122'));

  it('should create a signature without failling', function() {
    var k = Key.generateSync();
    var pkshex = 'b7dafe35d7d1aab78b53982c8ba554584518f86d50af565c98e053613c8f15e0';
    k.private = new Buffer(pkshex, 'hex');
    k.regenerateSync();
    k.compressed.should.be.ok;
    buffertools.toHex(k.private).should.equal(pkshex);
    k.signSync.bind(k,a_hash).should.not.Throw(Error);
  });
  it('roundtrip for signature/verify', function() {
    var k = Key.generateSync();
    var pub = k.public;

    // sign 
    var sig = k.signSync(a_hash);

    // checks sig. priv unknown.
    var k2 = new Key();
    k2.public = pub;
    var ret= k2.verifySignatureSync(a_hash, sig);
    ret.should.equal(true);
  });

  it('should verify a hardcoded example', function() {
    var k = new Key();
    k.private = new Buffer('876156ccb16bb1760ddda6ad3e561c026fc0d679ad7860b71dd11c30e42f6589','hex');
    k.regenerateSync();
    var pHex = bitcore.buffertools.toHex(k.public);
    pHex.should.equal('0394615227fd5ff4d4dfac88cf148e43d35a7a059788dd2479f60cea807b09d0c2');
    var a_hash = new Buffer('ce42c5c7f405461c38ea849130f51e48531ab3188390a21a15aeaa1faedbf0b2','hex');
    var sig= new Buffer('304602210099f689f846a1590cf57f9cede2fe841d8552f114bc9e5f5603a333b00e69d3fa022100e83604ddd5f1ce6f5add3ac8da7dbf17f3ffe5b47205f3899caeaa54abdbcf07','hex');

    var ret= k.verifySignatureSync(a_hash, sig);
    ret.should.equal(true);

    var sig2= new Buffer('304602210099f689f846a1590cf57f9cede2fe841d8552f114bc9e5f5603a333b00e69d3fa022100e83604ddd5f1ce6f5add3ac8da7dbf17f3ffe5b47205f3899caeaa54abdbcf08', 'hex');
    var ret= k.verifySignatureSync(a_hash, sig2);
    ret.should.equal(false);
  });

});
