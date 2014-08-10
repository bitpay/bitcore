var ECDSA = require('../lib/ecdsa');
var Hash = require('../lib/hash');
var Key = require('../lib/key');
var Privkey = require('../lib/privkey');
var Pubkey = require('../lib/pubkey');
var Signature = require('../lib/signature');
var bn = require('../lib/bn');
var point = require('../lib/point');
var should = require('chai').should();

describe("ecdsa", function() {

  it('should create a blank ecdsa', function() {
    var ecdsa = new ECDSA();
  });

  var ecdsa = new ECDSA();
  ecdsa.hash = Hash.sha256(new Buffer('test data'));
  ecdsa.key = new Key();
  ecdsa.key.privkey = new Privkey(bn.fromBuffer(new Buffer('fee0a1f7afebf9d2a5a80c0c98a31c709681cce195cbcd06342b517970c0be1e', 'hex')));
  ecdsa.key.pubkey = new Pubkey(point(bn.fromBuffer(new Buffer('ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2', 'hex')),
                                      bn.fromBuffer(new Buffer('4836ab292c105a711ed10fcfd30999c31ff7c02456147747e03e739ad527c380', 'hex'))));

  describe('#fromString', function() {
    
    it('should to a round trip with to string', function() {
      var str = ecdsa.toString();
      var ecdsa2 = new ECDSA();
      ecdsa2.fromString(str);
      should.exist(ecdsa.hash);
      should.exist(ecdsa.key);
    });

  });

  describe('#randomK', function() {
    
    it('should generate a new random k when called twice in a row', function() {
      ecdsa.randomK();
      var k1 = ecdsa.k;
      ecdsa.randomK();
      var k2 = ecdsa.k;
      (k1.cmp(k2) === 0).should.equal(false);
    });

    it('should generate a random k that is (almost always) greater than this relatively small number', function() {
      ecdsa.randomK();
      var k1 = ecdsa.k;
      var k2 = bn(Math.pow(2, 32)).mul(bn(Math.pow(2, 32))).mul(bn(Math.pow(2, 32)));
      k2.gt(k1).should.equal(false);
    });

  });

  describe('#sigError', function() {

    it('should return an error if the hash is invalid', function() {
      var ecdsa = new ECDSA();
      ecdsa.sigError().should.equal('Invalid hash');
    });

    it('should return an error if the pubkey is invalid', function() {
      var ecdsa = new ECDSA();
      ecdsa.hash = Hash.sha256(new Buffer('test'));
      ecdsa.sigError().should.equal("Invalid pubkey: TypeError: Cannot read property 'pubkey' of undefined");
    });

    it('should return an error if r, s are invalid', function() {
      var ecdsa = new ECDSA();
      ecdsa.hash = Hash.sha256(new Buffer('test'));
      ecdsa.pubkey = new Pubkey();
      ecdsa.pubkey.fromDER(new Buffer('041ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341', 'hex'));
      ecdsa.sig = new Signature();
      ecdsa.sig.r = bn(0);
      ecdsa.sig.s = bn(0);
      ecdsa.sigError().should.equal("Invalid pubkey: TypeError: Cannot read property 'pubkey' of undefined");
    });

    it('should return an error if the signature is incorrect', function() {
      ecdsa.sig = new Signature();
      ecdsa.sig.fromString('3046022100e9915e6236695f093a4128ac2a956c40ed971531de2f4f41ba05fac7e2bd019c02210094e6a4a769cc7f2a8ab3db696c7cd8d56bcdbfff860a8c81de4bc6a798b90827');
      ecdsa.sig.r = ecdsa.sig.r.add(bn(1));
      ecdsa.sigError().should.equal("Invalid signature");
    });

  });

  describe('#sign', function() {
    
    it('should create a valid signature', function() {
      ecdsa.randomK();
      ecdsa.sign();
      ecdsa.verify().should.equal(true);
    });

  });

  describe('#signRandomK', function() {

    it('should produce a signature', function() {
      ecdsa.signRandomK();
      should.exist(ecdsa.sig);
    });

  });

  describe('#toString', function() {
    
    it('should convert this to a string', function() {
      var str = ecdsa.toString();
      (typeof str === 'string').should.equal(true);
    });

  });

  describe('#verify', function() {
    
    it('should verify a signature that was just signed', function() {
      ecdsa.sig = new Signature();
      ecdsa.sig.fromString('3046022100e9915e6236695f093a4128ac2a956c40ed971531de2f4f41ba05fac7e2bd019c02210094e6a4a769cc7f2a8ab3db696c7cd8d56bcdbfff860a8c81de4bc6a798b90827');
      ecdsa.verify().should.equal(true);
    });

    it('should verify this known good signature', function() {
      ecdsa.signRandomK();
      ecdsa.verify().should.equal(true);
    });

  });

});
