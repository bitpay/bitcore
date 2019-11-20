'use strict';

var ECDSA = require('../../lib/crypto/ecdsa');
var Hash = require('../../lib/crypto/hash');
var Privkey = require('../../lib/privatekey');
var Pubkey = require('../../lib/publickey');
var Signature = require('../../lib/crypto/signature');
var BN = require('../../lib/crypto/bn');
var point = require('../../lib/crypto/point');
var should = require('chai').should();
var vectors = require('../data/ecdsa');

describe('ECDSA', function() {

  it('instantiation', function() {
    var ecdsa = new ECDSA();
    should.exist(ecdsa);
  });

  var ecdsa = new ECDSA();
  ecdsa.hashbuf = Hash.sha256(Buffer.from('test data'));
  ecdsa.privkey = new Privkey(BN.fromBuffer(
    Buffer.from('fee0a1f7afebf9d2a5a80c0c98a31c709681cce195cbcd06342b517970c0be1e', 'hex')
  ));
  ecdsa.privkey2pubkey();

  describe('#set', function() {
    it('sets hashbuf', function() {
      should.exist(ECDSA().set({
        hashbuf: ecdsa.hashbuf
      }).hashbuf);
    });
  });

  describe('#calci', function() {
    it('calculates i correctly', function() {
      ecdsa.randomK();
      ecdsa.sign();
      ecdsa.calci();
      should.exist(ecdsa.sig.i);
    });

    it('calulates this known i', function() {
      var hashbuf = Hash.sha256(Buffer.from('some data'));
      var r = new BN('71706645040721865894779025947914615666559616020894583599959600180037551395766', 10);
      var s = new BN('109412465507152403114191008482955798903072313614214706891149785278625167723646', 10);
      var ecdsa = new ECDSA({
        privkey: new Privkey(BN.fromBuffer(Hash.sha256(Buffer.from('test')))),
        hashbuf: hashbuf,
        sig: new Signature({
          r: r,
          s: s
        })
      });

      ecdsa.calci();
      ecdsa.sig.i.should.equal(1);
    });

  });

  describe('#fromString', function() {

    it('round trip with fromString', function() {
      var str = ecdsa.toString();
      var ecdsa2 = new ECDSA.fromString(str);
      should.exist(ecdsa2.hashbuf);
      should.exist(ecdsa2.privkey);
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
      var k2 = new BN(Math.pow(2, 32)).mul(new BN(Math.pow(2, 32))).mul(new BN(Math.pow(2, 32)));
      k2.gt(k1).should.equal(false);
    });

  });

  describe('#deterministicK', function() {
    it('should generate the same deterministic k', function() {
      ecdsa.deterministicK();
      ecdsa.k.toBuffer().toString('hex')
        .should.equal('fcce1de7a9bcd6b2d3defade6afa1913fb9229e3b7ddf4749b55c4848b2a196e');
    });
    it('should generate the same deterministic k if badrs is set', function() {
      ecdsa.deterministicK(0);
      ecdsa.k.toBuffer().toString('hex')
        .should.equal('fcce1de7a9bcd6b2d3defade6afa1913fb9229e3b7ddf4749b55c4848b2a196e');
      ecdsa.deterministicK(1);
      ecdsa.k.toBuffer().toString('hex')
        .should.not.equal('fcce1de7a9bcd6b2d3defade6afa1913fb9229e3b7ddf4749b55c4848b2a196e');
      ecdsa.k.toBuffer().toString('hex')
        .should.equal('727fbcb59eb48b1d7d46f95a04991fc512eb9dbf9105628e3aec87428df28fd8');
    });
    it('should compute this test vector correctly', function() {
      // test fixture from bitcoinjs
      // https://github.com/bitcoinjs/bitcoinjs-lib/blob/10630873ebaa42381c5871e20336fbfb46564ac8/test/fixtures/ecdsa.json#L6
      var ecdsa = new ECDSA();
      ecdsa.hashbuf = Hash.sha256(Buffer.from('Everything should be made as simple as possible, but not simpler.'));
      ecdsa.privkey = new Privkey(new BN(1));
      ecdsa.privkey2pubkey();
      ecdsa.deterministicK();
      ecdsa.k.toBuffer().toString('hex')
        .should.equal('ec633bd56a5774a0940cb97e27a9e4e51dc94af737596a0c5cbb3d30332d92a5');
      ecdsa.sign();
      ecdsa.sig.r.toString()
        .should.equal('23362334225185207751494092901091441011938859014081160902781146257181456271561');
      ecdsa.sig.s.toString()
        .should.equal('50433721247292933944369538617440297985091596895097604618403996029256432099938');
    });
  });

  describe('#toPublicKey', function() {
    it('should calculate the correct public key', function() {
      ecdsa.k = new BN('114860389168127852803919605627759231199925249596762615988727970217268189974335', 10);
      ecdsa.sign();
      ecdsa.sig.i = 0;
      var pubkey = ecdsa.toPublicKey();
      pubkey.point.eq(ecdsa.pubkey.point).should.equal(true);
    });

    it('should calculate the correct public key for this signature with low s', function() {
      ecdsa.k = new BN('114860389168127852803919605627759231199925249596762615988727970217268189974335', 10);
      ecdsa.sig = Signature.fromString('3045022100ec3cfe0e335791ad278b4ec8eac93d0347' +
        'a97877bb1d54d35d189e225c15f6650220278cf15b05ce47fb37d2233802899d94c774d5480bba9f0f2d996baa13370c43');
      ecdsa.sig.i = 0;
      var pubkey = ecdsa.toPublicKey();
      pubkey.point.eq(ecdsa.pubkey.point).should.equal(true);
    });

    it('should calculate the correct public key for this signature with high s', function() {
      ecdsa.k = new BN('114860389168127852803919605627759231199925249596762615988727970217268189974335', 10);
      ecdsa.sign();
      ecdsa.sig = Signature.fromString('3046022100ec3cfe0e335791ad278b4ec8eac93d0347' +
        'a97877bb1d54d35d189e225c15f665022100d8730ea4fa31b804c82ddcc7fd766269f33a079ea38e012c9238f2e2bcff34fe');
      ecdsa.sig.i = 1;
      var pubkey = ecdsa.toPublicKey();
      pubkey.point.eq(ecdsa.pubkey.point).should.equal(true);
    });

  });

  describe('#sigError', function() {

    it('should return an error if the hash is invalid', function() {
      var ecdsa = new ECDSA();
      ecdsa.sigError().should.equal('hashbuf must be a 32 byte buffer');
    });

    it('should return an error if r, s are invalid', function() {
      var ecdsa = new ECDSA();
      ecdsa.hashbuf = Hash.sha256(Buffer.from('test'));
      var pk = Pubkey.fromDER(Buffer.from('041ff0fe0f7b15ffaa85ff9f4744d539139c252a49' +
        '710fb053bb9f2b933173ff9a7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341', 'hex'));
      ecdsa.pubkey = pk;
      ecdsa.sig = new Signature();
      ecdsa.sig.r = new BN(0);
      ecdsa.sig.s = new BN(0);
      ecdsa.sigError().should.equal('r and s not in range');
    });

    it('should return an error if the signature is incorrect', function() {
      ecdsa.sig = Signature.fromString('3046022100e9915e6236695f093a4128ac2a956c40' +
        'ed971531de2f4f41ba05fac7e2bd019c02210094e6a4a769cc7f2a8ab3db696c7cd8d56bcdbfff860a8c81de4bc6a798b90827');
      ecdsa.sig.r = ecdsa.sig.r.add(new BN(1));
      ecdsa.sigError().should.equal('Invalid signature');
    });

  });

  describe('#sign', function() {

    it('should create a valid signature', function() {
      ecdsa.randomK();
      ecdsa.sign();
      ecdsa.verify().verified.should.equal(true);
    });

    it('should should throw an error if hashbuf is not 32 bytes', function() {
      var ecdsa2 = ECDSA().set({
        hashbuf: ecdsa.hashbuf.slice(0, 31),
        privkey: ecdsa.privkey
      });
      ecdsa2.randomK();
      ecdsa2.sign.bind(ecdsa2).should.throw('hashbuf must be a 32 byte buffer');
    });

    it('should default to deterministicK', function() {
      var ecdsa2 = new ECDSA(ecdsa);
      ecdsa2.k = undefined;
      var called = 0;
      var deterministicK = ecdsa2.deterministicK.bind(ecdsa2);
      ecdsa2.deterministicK = function() {
        deterministicK();
        called++;
      };
      ecdsa2.sign();
      called.should.equal(1);
    });

    it('should generate right K', function() {
      var msg1 = Buffer.from('52204d20fd0131ae1afd173fd80a3a746d2dcc0cddced8c9dc3d61cc7ab6e966', 'hex');
      var msg2 = [].reverse.call(Buffer.from(msg1))
      var pk = Buffer.from('16f243e962c59e71e54189e67e66cf2440a1334514c09c00ddcc21632bac9808', 'hex');
      var signature1 = ECDSA.sign(msg1, Privkey.fromBuffer(pk)).toBuffer().toString('hex');
      var signature2 = ECDSA.sign(msg2, Privkey.fromBuffer(pk), 'little').toBuffer().toString('hex');
      signature1.should.equal(signature2);
    });

  });

  describe('#toString', function() {
    it('should convert this to a string', function() {
      var str = ecdsa.toString();
      (typeof str === 'string').should.equal(true);
    });
  });

  describe('signing and verification', function() {
    describe('@sign', function() {
      it('should produce a signature', function() {
        var sig = ECDSA.sign(ecdsa.hashbuf, ecdsa.privkey);
        (sig instanceof Signature).should.equal(true);
      });
      it('should produce a signature, and be different when called twice', function() {
        ecdsa.signRandomK();
        should.exist(ecdsa.sig);
        var ecdsa2 = ECDSA(ecdsa);
        ecdsa2.signRandomK();
        ecdsa.sig.toString().should.not.equal(ecdsa2.sig.toString());
      });
    });

    describe('#verify', function() {
      it('should verify a signature that was just signed', function() {
        ecdsa.sig = Signature.fromString('3046022100e9915e6236695f093a4128ac2a956c' +
          '40ed971531de2f4f41ba05fac7e2bd019c02210094e6a4a769cc7f2a8ab3db696c7cd8d56bcdbfff860a8c81de4bc6a798b90827');
        ecdsa.verify().verified.should.equal(true);
      });
      it('should verify this known good signature', function() {
        ecdsa.signRandomK();
        ecdsa.verify().verified.should.equal(true);
      });
      it('should verify a valid signature, and unverify an invalid signature', function() {
        var sig = ECDSA.sign(ecdsa.hashbuf, ecdsa.privkey);
        ECDSA.verify(ecdsa.hashbuf, sig, ecdsa.pubkey).should.equal(true);
        var fakesig = new Signature(sig.r.add(new BN(1)), sig.s);
        ECDSA.verify(ecdsa.hashbuf, fakesig, ecdsa.pubkey).should.equal(false);
      });
      it('should work with big and little endian', function() {
        var sig = ECDSA.sign(ecdsa.hashbuf, ecdsa.privkey, 'big');
        ECDSA.verify(ecdsa.hashbuf, sig, ecdsa.pubkey, 'big').should.equal(true);
        ECDSA.verify(ecdsa.hashbuf, sig, ecdsa.pubkey, 'little').should.equal(false);
        sig = ECDSA.sign(ecdsa.hashbuf, ecdsa.privkey, 'little');
        ECDSA.verify(ecdsa.hashbuf, sig, ecdsa.pubkey, 'big').should.equal(false);
        ECDSA.verify(ecdsa.hashbuf, sig, ecdsa.pubkey, 'little').should.equal(true);
      });
    });

    describe('vectors', function() {

      vectors.valid.forEach(function(obj, i) {
        it('should validate valid vector ' + i, function() {
          var ecdsa = ECDSA().set({
            privkey: new Privkey(BN.fromBuffer(Buffer.from(obj.d, 'hex'))),
            k: BN.fromBuffer(Buffer.from(obj.k, 'hex')),
            hashbuf: Hash.sha256(Buffer.from(obj.message)),
            sig: new Signature().set({
              r: new BN(obj.signature.r),
              s: new BN(obj.signature.s),
              i: obj.i
            })
          });
          var ecdsa2 = ECDSA(ecdsa);
          ecdsa2.k = undefined;
          ecdsa2.sign();
          ecdsa2.calci();
          ecdsa2.k.toString().should.equal(ecdsa.k.toString());
          ecdsa2.sig.toString().should.equal(ecdsa.sig.toString());
          ecdsa2.sig.i.should.equal(ecdsa.sig.i);
          ecdsa.verify().verified.should.equal(true);
        });
      });

      vectors.invalid.sigError.forEach(function(obj, i) {
        it('should validate invalid.sigError vector ' + i + ': ' + obj.description, function() {
          var ecdsa = ECDSA().set({
            pubkey: Pubkey.fromPoint(point.fromX(true, 1)),
            sig: new Signature(new BN(obj.signature.r), new BN(obj.signature.s)),
            hashbuf: Hash.sha256(Buffer.from(obj.message))
          });
          ecdsa.sigError().should.equal(obj.exception);
        });
      });

      vectors.deterministicK.forEach(function(obj, i) {
        it('should validate deterministicK vector ' + i, function() {
          var hashbuf = Hash.sha256(Buffer.from(obj.message));
          var privkey = Privkey(BN.fromBuffer(Buffer.from(obj.privkey, 'hex')), 'mainnet');
          var ecdsa = ECDSA({
            privkey: privkey,
            hashbuf: hashbuf
          });
          ecdsa.deterministicK(0).k.toString('hex').should.equal(obj.k_bad00);
          ecdsa.deterministicK(1).k.toString('hex').should.equal(obj.k_bad01);
          ecdsa.deterministicK(15).k.toString('hex').should.equal(obj.k_bad15);
        });
      });

    });
  });
});
