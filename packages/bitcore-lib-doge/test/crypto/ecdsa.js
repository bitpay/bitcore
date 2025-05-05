'use strict';

const should = require('chai').should();
const ECDSA = require('../../lib/crypto/ecdsa');
const Hash = require('../../lib/crypto/hash');
const PrivateKey = require('../../lib/privatekey');
const Pubkey = require('../../lib/publickey');
const Signature = require('../../lib/crypto/signature');
const BN = require('../../lib/crypto/bn');
const point = require('../../lib/crypto/point');
const vectors = require('../data/ecdsa');

describe('ECDSA', function() {

  const hashbuf = Hash.sha256(Buffer.from('test data'));
  const privkey = new PrivateKey(new BN('fee0a1f7afebf9d2a5a80c0c98a31c709681cce195cbcd06342b517970c0be1e', 16));
  const pubkey = privkey.toPublicKey();
  const signature = ECDSA.sign(hashbuf, privkey);

  describe('#calci', function() {
    it('calculates i correctly', function() {
      const sig = ECDSA.sign(hashbuf, privkey);
      ECDSA.calci(hashbuf, sig, pubkey);
      should.exist(sig.i);
    });

    it('calulates this known i', function() {
      var hashbuf = Hash.sha256(Buffer.from('some data'));
      const sig = new Signature({
        r: new BN('71706645040721865894779025947914615666559616020894583599959600180037551395766', 10),
        s: new BN('109412465507152403114191008482955798903072313614214706891149785278625167723646', 10)
      });
      const privkey = new PrivateKey(new BN.fromBuffer(Hash.sha256(Buffer.from('test'))));
      ECDSA.calci(hashbuf, sig, privkey.toPublicKey());
      sig.i.should.equal(1);
    });

  });

  describe('#getRandomK', function() {

    it('should generate a new random k when called twice in a row', function() {
      var k1 = ECDSA.__testing__.getRandomK();
      var k2 = ECDSA.__testing__.getRandomK();
      (k1.cmp(k2) === 0).should.equal(false);
    });

    it('should generate a random k that is (almost always) greater than this relatively small number', function() {
      var k1 = ECDSA.__testing__.getRandomK();
      var k2 = new BN(Math.pow(2, 32)).mul(new BN(Math.pow(2, 32))).mul(new BN(Math.pow(2, 32)));
      k2.gt(k1).should.equal(false);
    });

  });

  describe('#getDeterministicK', function() {
    it('should generate the same deterministic k', function() {
      var k = ECDSA.__testing__.getDeterministicK(hashbuf, privkey);
      k.toBuffer().toString('hex')
        .should.equal('fcce1de7a9bcd6b2d3defade6afa1913fb9229e3b7ddf4749b55c4848b2a196e');
    });

    it('should generate the same deterministic k if badrs is set', function() {
      var k = ECDSA.__testing__.getDeterministicK(hashbuf, privkey, 0);
      k.toBuffer().toString('hex')
        .should.equal('fcce1de7a9bcd6b2d3defade6afa1913fb9229e3b7ddf4749b55c4848b2a196e');
      k = ECDSA.__testing__.getDeterministicK(hashbuf, privkey, 1);
      k.toBuffer().toString('hex')
        .should.not.equal('fcce1de7a9bcd6b2d3defade6afa1913fb9229e3b7ddf4749b55c4848b2a196e');
      k.toBuffer().toString('hex')
        .should.equal('727fbcb59eb48b1d7d46f95a04991fc512eb9dbf9105628e3aec87428df28fd8');
    });

    it('should compute this test vector correctly', function() {
      // test fixture from bitcoinjs
      // https://github.com/bitcoinjs/bitcoinjs-lib/blob/10630873ebaa42381c5871e20336fbfb46564ac8/test/fixtures/ecdsa.json#L6
      const hashbuf = Hash.sha256(Buffer.from('Everything should be made as simple as possible, but not simpler.'));
      const privkey = new PrivateKey(new BN(1));
      const k = ECDSA.__testing__.getDeterministicK(hashbuf, privkey);
      k.toBuffer().toString('hex')
        .should.equal('ec633bd56a5774a0940cb97e27a9e4e51dc94af737596a0c5cbb3d30332d92a5');
      const sig = ECDSA.sign(hashbuf, privkey);
      sig.r.toString()
        .should.equal('23362334225185207751494092901091441011938859014081160902781146257181456271561');
      sig.s.toString()
        .should.equal('50433721247292933944369538617440297985091596895097604618403996029256432099938');
    });
  });

  describe('#recoverPublicKey', function() {
    it('should calculate the correct public key', function() {
      const sig = ECDSA.sign(hashbuf, privkey);
      ECDSA.calci(hashbuf, sig, privkey.publicKey);      
      const pubkey = ECDSA.recoverPublicKey(hashbuf, sig);
      pubkey.point.eq(privkey.publicKey.point).should.equal(true);
    });

    it('should calculate the correct public key for this signature with low s', function() {
      const sig = Signature.fromString('3045022100ec3cfe0e335791ad278b4ec8eac93d0347a97877bb1d54d35d189e225c15f6650220278cf15b05ce47fb37d2233802899d94c774d5480bba9f0f2d996baa13370c43');
      sig.i = 0;
      const pubkey = ECDSA.recoverPublicKey(hashbuf, sig);
      pubkey.point.eq(privkey.publicKey.point).should.equal(true);
    });

    it('should calculate the correct public key for this signature with high s', function() {
      const sig = Signature.fromString('3046022100ec3cfe0e335791ad278b4ec8eac93d0347a97877bb1d54d35d189e225c15f665022100d8730ea4fa31b804c82ddcc7fd766269f33a079ea38e012c9238f2e2bcff34fe');
      sig.i = 1;
      const pubkey = ECDSA.recoverPublicKey(hashbuf, sig);
      pubkey.point.eq(privkey.publicKey.point).should.equal(true);
    });

  });

  describe('#verificationError', function() {

    it('should return an error if the hash is invalid', function() {
      ECDSA.verificationError(null, signature, pubkey).should.equal('hashbuf must be a 32 byte buffer');
    });

    it('should return an error if r, s are invalid', function() {
      const hashbuf = Hash.sha256(Buffer.from('test'));
      const pk = Pubkey.fromDER(Buffer.from('041ff0fe0f7b15ffaa85ff9f4744d539139c252a49710fb053bb9f2b933173ff9a7baad41d04514751e6851f5304fd243751703bed21b914f6be218c0fa354a341', 'hex'));
      const sig = new Signature({
        r: new BN(0),
        s: new BN(0)
      });
      ECDSA.verificationError(hashbuf, sig, pk).should.equal('r and s not in range');
    });

    it('should return an error if the signature is incorrect', function() {
      const sig = Signature.fromString('3046022100e9915e6236695f093a4128ac2a956c40ed971531de2f4f41ba05fac7e2bd019c02210094e6a4a769cc7f2a8ab3db696c7cd8d56bcdbfff860a8c81de4bc6a798b90827');
      sig.r = sig.r.add(new BN(1));
      ECDSA.verificationError(hashbuf, sig, pubkey).should.equal('Invalid signature');
    });

  });

  describe('#sign', function() {

    it('should create a valid signature', function() {
      const sig = ECDSA.sign(hashbuf, privkey);
      ECDSA.verify(hashbuf, sig, pubkey).should.equal(true);
    });

    it('should create a valid signature defaulting to deterministicK', function() {
      const sig = ECDSA.sign(hashbuf, privkey);
      sig.toString('hex').should.equal(signature.toString('hex'));
    });

    it('should create a valid signature explicitly using deterministicK', function() {
      const sig = ECDSA.sign(hashbuf, privkey, { randomK: false });
      sig.toString('hex').should.equal(signature.toString('hex'));
    });

    it('should create a valid signature using randomK', function() {
      const sig = ECDSA.sign(hashbuf, privkey, { randomK: true });
      ECDSA.verify(hashbuf, sig, pubkey).should.equal(true);
      sig.toString('hex').should.not.equal(signature.toString('hex'));
    });

    it('should not re-use k values', function() {
      const sig1 = ECDSA.sign(hashbuf, privkey, { randomK: true });
      const sig2 = ECDSA.sign(hashbuf, privkey, { randomK: true });
      sig1.toString('hex').should.not.equal(sig2.toString('hex'));
    });

    it('should should throw an error if hashbuf is not 32 bytes', function() {
      try {
        ECDSA.sign(hashbuf.slice(0, 31), privkey, { randomK: true });
        throw new Error('should have thrown');
      } catch (e) {
        e.message.should.equal('Invalid state: hashbuf must be a 32 byte buffer');
      }
    });

    it('should generate right K', function() {
      const msg1 = Buffer.from('52204d20fd0131ae1afd173fd80a3a746d2dcc0cddced8c9dc3d61cc7ab6e966', 'hex');
      const msg2 = [].reverse.call(Buffer.from(msg1))
      const pk = Buffer.from('16f243e962c59e71e54189e67e66cf2440a1334514c09c00ddcc21632bac9808', 'hex');
      const signature1 = ECDSA.sign(msg1, PrivateKey.fromBuffer(pk)).toBuffer().toString('hex');
      const signature2 = ECDSA.sign(msg2, PrivateKey.fromBuffer(pk), { endian: 'little' }).toBuffer().toString('hex');
      signature1.should.equal(signature2);
    });

    it('should generate correct signature for Uint8Array input', function() {
      const pk = PrivateKey.fromString('1471d2f131a665b24d419f0920e854993153391e64d1971704ded65ffc3d1f0c');
      const hashbuf = Buffer.from('7afd0a663b64666242ef6edf3542bc18a6a4587b01249a1fd2d8164b0eedf8d6', 'hex');
      const ctrlSig = ECDSA.sign(hashbuf, pk);
      const testSig = ECDSA.sign(Uint8Array.from(hashbuf), pk);
      ctrlSig.toString('hex').should.equal('30450221009cf9c9f5e45fba55c5f3237423158ecbdb66267edfc18742bef13277d919d8e302200d83137ceaab33eea61c7a5cbbebc5856cdc524f396556eadeae2a1f1d9bb691');
      ctrlSig.toString('hex').should.equal(testSig.toString('hex'));
    });

    it('should throw on improper input: Array', function() {
      const pk = PrivateKey.fromString('1471d2f131a665b24d419f0920e854993153391e64d1971704ded65ffc3d1f0c');
      const hashbuf = Buffer.from('7afd0a663b64666242ef6edf3542bc18a6a4587b01249a1fd2d8164b0eedf8d6', 'hex');
      should.throw(
        () => ECDSA.sign(Array.from(hashbuf), pk),
        'Invalid state: hashbuf must be a 32 byte buffer'
      );
    });

    it('should throw on improper input: Uint16Array', function() {
      const pk = PrivateKey.fromString('1471d2f131a665b24d419f0920e854993153391e64d1971704ded65ffc3d1f0c');
      const hashbuf = Buffer.from('7afd0a663b64666242ef6edf3542bc18a6a4587b01249a1fd2d8164b0eedf8d6', 'hex');
      should.throw(
        () => ECDSA.sign(Uint16Array.from(hashbuf), pk),
        'Invalid state: hashbuf must be a 32 byte buffer'
      );
    });

  });

  describe('#verify', function() {
    it('should verify a signature that was just signed', function() {
      const sig = Signature.fromString('3046022100e9915e6236695f093a4128ac2a956c40ed971531de2f4f41ba05fac7e2bd019c02210094e6a4a769cc7f2a8ab3db696c7cd8d56bcdbfff860a8c81de4bc6a798b90827');
      ECDSA.verify(hashbuf, sig, pubkey).should.equal(true);
    });
    it('should verify this known good signature', function() {
      const sig = ECDSA.sign(hashbuf, privkey, { randomK: true });
      ECDSA.verify(hashbuf, sig, pubkey).should.equal(true);
    });
    it('should verify a valid signature, and unverify an invalid signature', function() {
      const sig = ECDSA.sign(hashbuf, privkey);
      ECDSA.verify(hashbuf, sig, pubkey).should.equal(true);
      const fakesig = new Signature(sig.r.add(new BN(1)), sig.s);
      ECDSA.verify(hashbuf, fakesig, pubkey).should.equal(false);
    });
    it('should work with big and little endian', function() {
      let sig = ECDSA.sign(hashbuf, privkey, { endian: 'big' });
      ECDSA.verify(hashbuf, sig, pubkey, { endian: 'big' }).should.equal(true);
      ECDSA.verify(hashbuf, sig, pubkey, { endian: 'little' }).should.equal(false);
      sig = ECDSA.sign(hashbuf, privkey, { endian: 'little' });
      ECDSA.verify(hashbuf, sig, pubkey, { endian: 'big' }).should.equal(false);
      ECDSA.verify(hashbuf, sig, pubkey, { endian: 'little' }).should.equal(true);
    });
  });

  describe('vectors', function() {

    for (const i in vectors.valid) {
      const obj = vectors.valid[i];

      it('should validate valid vector ' + i, function() {
        const privkey = new PrivateKey(new BN(obj.d, 16));
        const vectorK = new BN(obj.k, 16);
        const hashbuf = Hash.sha256(Buffer.from(obj.message));
        const vectorSig = new Signature({
          r: new BN(obj.signature.r),
          s: new BN(obj.signature.s),
          i: obj.i
        });
        
        const sig = ECDSA.sign(hashbuf, privkey);
        ECDSA.calci(hashbuf, sig, privkey.publicKey);
        const k = ECDSA.__testing__.getDeterministicK(hashbuf, privkey)
        k.toString('hex').should.equal(vectorK.toString('hex'));
        sig.toString().should.equal(vectorSig.toString());
        sig.i.should.equal(obj.i);
        ECDSA.verify(hashbuf, sig, privkey.publicKey).should.equal(true);
      });
    }

    for (const i in vectors.invalid.sigError) {
      const obj = vectors.invalid.sigError[i];

      it('should validate invalid.sigError vector ' + i + ': ' + obj.description, function() {
        const pubkey = Pubkey.fromPoint(point.fromX(true, 1));
        const sig = new Signature(new BN(obj.signature.r), new BN(obj.signature.s));
        const hashbuf = Hash.sha256(Buffer.from(obj.message));
        const error = ECDSA.verificationError(hashbuf, sig, pubkey);
        error.should.equal(obj.exception);
      });
    }

    for (const i in vectors.deterministicK) {
      const obj = vectors.deterministicK[i];

      it('should validate deterministicK vector ' + i, function() {
        const hashbuf = Hash.sha256(Buffer.from(obj.message));
        const privkey = new PrivateKey(new BN(obj.privkey, 16), 'mainnet');
        ECDSA.__testing__.getDeterministicK(hashbuf, privkey, 0).toString('hex').should.equal(obj.k_bad00);
        ECDSA.__testing__.getDeterministicK(hashbuf, privkey, 1).toString('hex').should.equal(obj.k_bad01);
        ECDSA.__testing__.getDeterministicK(hashbuf, privkey, 15).toString('hex').should.equal(obj.k_bad15);
      });
    }

  });
});
