'use strict';

var should = require('chai').should();
var bitcore = require('../..');
var ECDSA = bitcore.crypto.ECDSA;
var Hash = bitcore.crypto.Hash;
var PrivateKey = bitcore.PrivateKey;
var PublicKey = bitcore.PublicKey;
var Signature = bitcore.Signature;
var BN = bitcore.crypto.BN;
var Point = bitcore.crypto.Point;

describe('ECDSA', function() {

  it('should create a blank ecdsa', function() {
    var ecdsa = new ECDSA();
    should.exist(ecdsa);
  });

  var ecdsa = new ECDSA();
  ecdsa.hashbuf = Hash.sha256(new Buffer('test data'));
  ecdsa.privkey = new PrivateKey(BN().fromBuffer(new Buffer('fee0a1f7afebf9d2a5a80c0c98a31c709681cce195cbcd06342b517970c0be1e', 'hex')));
  ecdsa.pubkey = new PublicKey(Point(BN().fromBuffer(new Buffer('ac242d242d23be966085a2b2b893d989f824e06c9ad0395a8a52f055ba39abb2', 'hex'))));

  describe('#set', function() {
    
    it('should set hashbuf', function() {
      should.exist(ECDSA().set({hashbuf: ecdsa.hashbuf}).hashbuf);
    });

  });

  describe('#calci', function() {
    
    it('should calculate i', function() {
      ecdsa.randomK();
      ecdsa.sign();
      ecdsa.calci();
      should.exist(ecdsa.sig.i);
    });

    it('should calulate this known i', function() {
      var hashbuf = Hash.sha256(new Buffer('some data'));
      var r = BN('71706645040721865894779025947914615666559616020894583599959600180037551395766', 10);
      var s = BN('109412465507152403114191008482955798903072313614214706891149785278625167723646', 10);
      var ecdsa = new ECDSA();
      ecdsa.privkey = PrivateKey(BN().fromBuffer(Hash.sha256(new Buffer('test'))));
      ecdsa.privkey2pubkey();
      ecdsa.hashbuf = hashbuf;
      ecdsa.sig = new Signature({r: r, s: s});
      ecdsa.calci();
      ecdsa.sig.i.should.equal(1);
    });

  });

  describe('#fromString', function() {
    
    it('should to a round trip with to string', function() {
      var str = ecdsa.toString();
      var ecdsa2 = new ECDSA();
      ecdsa2.fromString(str);
      should.exist(ecdsa.hashbuf);
      should.exist(ecdsa.pubkey);
      should.exist(ecdsa.privkey);
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
      var k2 = BN(Math.pow(2, 32)).mul(BN(Math.pow(2, 32))).mul(BN(Math.pow(2, 32)));
      k2.gt(k1).should.equal(false);
    });

  });

  describe('#sig2pubkey', function() {

    it('should calculate the correct public key', function() {
      ecdsa.k = BN('114860389168127852803919605627759231199925249596762615988727970217268189974335', 10);
      ecdsa.sign();
      ecdsa.sig.i = 1;
      var pubkey = ecdsa.sig2pubkey();
      pubkey.point.eq(ecdsa.pubkey.point).should.equal(true);
    });

  });

  describe('#sigError', function() {

    it('should return an error if the hash is invalid', function() {
      var ecdsa = new ECDSA();
      ecdsa.sigError().should.equal('hashbuf must be a 32 byte buffer');
    });

    it('should return an error if the pubkey is invalid', function() {
      var ecdsa = new ECDSA();
      ecdsa.hashbuf = Hash.sha256(new Buffer('test'));
      ecdsa.sigError().indexOf("Invalid pubkey").should.equal(0);
    });

    it('should return an error if r, s are invalid', function() {
      var ecdsa = new ECDSA();
      ecdsa.hashbuf = Hash.sha256(new Buffer('test'));
      var pk = new PublicKey();
      pk.fromDER(new Buffer('041ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341', 'hex'));
      ecdsa.pubkey = pk;
      ecdsa.sig = new Signature();
      ecdsa.sig.r = BN(0);
      ecdsa.sig.s = BN(0);
      ecdsa.sigError().should.equal("r and s not in range");
    });

    it('should return an error if the signature is incorrect', function() {
      ecdsa.sig = new Signature();
      ecdsa.sig.fromString('3046022100e9915e6236695f093a4128ac2a956c40ed971531de2f4f41ba05fac7e2bd019c02210094e6a4a769cc7f2a8ab3db696c7cd8d56bcdbfff860a8c81de4bc6a798b90827');
      ecdsa.sig.r = ecdsa.sig.r.add(BN(1));
      ecdsa.sigError().should.equal("Invalid signature");
    });

  });

  describe('#sign', function() {
    
    it('should create a valid signature', function() {
      ecdsa.randomK();
      ecdsa.sign();
      ecdsa.verify().should.equal(true);
    });

    it('should should throw an error if hashbuf is not 32 bytes', function() {
      var ecdsa2 = ECDSA().set({
        hashbuf: ecdsa.hashbuf.slice(0, 31),
        pubkey: ecdsa.pubkey,
        privkey: ecdsa.privkey
      });
      ecdsa2.randomK();
      (function() {
        ecdsa2.sign();
      }).should.throw('hashbuf must be a 32 byte buffer');
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

  describe('@sign', function() {
    
    it('should produce a signature', function() {
      var sig = ECDSA.sign(ecdsa.hashbuf, ecdsa.privkey);
      (sig instanceof Signature).should.equal(true);
    });

  });

  describe('@verify', function() {

    it('should verify a valid signature, and unverify an invalid signature', function() {
      var sig = ECDSA.sign(ecdsa.hashbuf, ecdsa.privkey);
      ECDSA.verify(ecdsa.hashbuf, sig, ecdsa.pubkey).should.equal(true);
      var fakesig = Signature(sig.r.add(1), sig.s);
      ECDSA.verify(ecdsa.hashbuf, fakesig, ecdsa.pubkey).should.equal(false);
    });

  });

});
