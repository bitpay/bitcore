'use strict';

// const { describe, it } = require('node:test');
const assert = require('assert');
const bitcore = require('@bitpay-labs/bitcore-lib');
const ECIES = require('../ecies/ecies');

const PrivateKey = bitcore.PrivateKey;

describe.only('ECIES', function() {
  const aliceKey = new PrivateKey('L1Ejc5dAigm5XrM3mNptMEsNnHzS7s51YxU7J61ewGshZTKkbmzJ');
  const bobKey = new PrivateKey('KxfxrUXSMjJQcb3JgnaaA6MqsrKQ1nBSxvhuigdKRyFiEm6BZDgG');

  const alice = {
    encrypt: (msg, opts) => ECIES.encrypt({ message: msg, privateKey: aliceKey, publicKey: bobKey.publicKey, opts }),
    decrypt: (enc, opts) => ECIES.decrypt({ payload: enc, privateKey: aliceKey, publicKey: opts?.noKey ? bobKey.publicKey : undefined, opts })
  };

  const bob = {
    encrypt: (msg, opts) => ECIES.encrypt({ message: msg, privateKey: bobKey, publicKey: aliceKey.publicKey, opts }),
    decrypt: (enc, opts) => ECIES.decrypt({ payload: enc, privateKey: bobKey, publicKey: opts?.noKey ? aliceKey.publicKey : undefined, opts })
  };

  const message = 'attack at dawn';
  const encrypted = '0339e504d6492b082da96e11e8f039796b06cd4855c101e2492a6f10f3e056a9e712c732611c6917ab5c57a1926973bc443f82df921cd5c8593113579d66dd26a0aa42e31b7b00158387ac5f846f0a49e702bf8155d027a4cc4bd7ae9f7681d188';
  const encBuf = Buffer.from(encrypted, 'hex');
  const encryptedNoKey = '12c732611c6917ab5c57a1926973bc443f82df921cd5c8593113579d66dd26a0aa42e31b7b00158387ac5f846f0a49e702bf8155d027a4cc4bd7ae9f7681d188';
  const encNoKeyBuf = Buffer.from(encryptedNoKey, 'hex');

  describe('KDF', function() {
    it('should generate the same keys', function() {
      const [kE1, kM1] = ECIES.KDF(aliceKey, bobKey.publicKey);
      const [kE2, kM2] = ECIES.KDF(bobKey, aliceKey.publicKey, true);
      assert.strictEqual(kE1.toString('hex'), kE2.toString('hex'));
      assert.strictEqual(kM1.toString('hex'), kM2.toString('hex'));
    });

    it('should generate the same keys regardless of key compression', function() {
      const aliceKeyUncompressed = new PrivateKey.fromObject({
        bn: aliceKey.bn,
        compressed: false,
        network: 'livenet'
      });
      const bobKeyUncompressed = new PrivateKey.fromObject({
        bn: bobKey.bn,
        compressed: false,
        network: 'livenet'
      });
      // Ensure that the keys are compressed/uncompressed as expected
      assert.strictEqual(aliceKey.compressed, true);
      assert.strictEqual(bobKey.compressed, true);
      assert.strictEqual(aliceKey.publicKey.compressed, true);
      assert.strictEqual(bobKey.publicKey.compressed, true);
      assert.strictEqual(aliceKeyUncompressed.compressed, false);
      assert.strictEqual(bobKeyUncompressed.compressed, false);
      assert.strictEqual(aliceKeyUncompressed.publicKey.compressed, false);
      assert.strictEqual(bobKeyUncompressed.publicKey.compressed, false);

      // Mix of compressions
      const [kE1, kM1] = ECIES.KDF(aliceKey, bobKeyUncompressed.publicKey);
      const [kE2, kM2] = ECIES.KDF(bobKey, aliceKeyUncompressed.publicKey, true);
      assert.strictEqual(kE1.toString('hex'), kE2.toString('hex'));
      assert.strictEqual(kM1.toString('hex'), kM2.toString('hex'));

      // All uncompressed
      const [kE3, kM3] = ECIES.KDF(aliceKeyUncompressed, bobKeyUncompressed.publicKey);
      const [kE4, kM4] = ECIES.KDF(bobKeyUncompressed, aliceKeyUncompressed.publicKey, true);
      assert.strictEqual(kE3.toString('hex'), kE4.toString('hex'));
      assert.strictEqual(kM3.toString('hex'), kM4.toString('hex'));

      // All should equal
      assert.strictEqual(kE1.toString('hex'), kE3.toString('hex'));
      assert.strictEqual(kM1.toString('hex'), kM3.toString('hex'));
      assert.strictEqual(kE1.toString('hex'), kE4.toString('hex'));
      assert.strictEqual(kM1.toString('hex'), kM4.toString('hex'));
    });
  });

  it('correctly encrypts a message', function() {
    const ciphertext = alice.encrypt(message, { deterministicIv: true });
    assert.strictEqual(Buffer.isBuffer(ciphertext), true);
    assert.strictEqual(ciphertext.toString('hex'), encrypted);
  });

  it('correctly decrypts a message', function() {
    const decrypted = bob.decrypt(encBuf);
    assert.strictEqual(Buffer.isBuffer(decrypted), true);
    assert.strictEqual(decrypted.toString(), message);
  });

  it('correctly encrypts a message without key', function() {
    const ciphertext = alice.encrypt(message, { noKey: true, deterministicIv: true });
    assert.strictEqual(Buffer.isBuffer(ciphertext), true);
    assert.strictEqual(ciphertext.toString('hex'), encryptedNoKey);
  });

  it('correctly decrypts a message without key', function() {
    const decrypted = bob.decrypt(encNoKeyBuf, { noKey: true, deterministicIv: true });
    assert.strictEqual(Buffer.isBuffer(decrypted), true);
    assert.strictEqual(decrypted.toString(), message);
  });

  it('encrypts a message with random IV', function() {
    const ciphertext = alice.encrypt(message);
    assert.strictEqual(Buffer.isBuffer(ciphertext), true);
    assert.notEqual(ciphertext.toString('hex'), encrypted);
  });

  it('roundtrips', function() {
    const secret = 'some secret message!!!';
    const encrypted = alice.encrypt(secret);
    const decrypted = bob
      .decrypt(encrypted)
      .toString();
    assert.strictEqual(decrypted, secret);
  });

  it('roundtrips (no public key)', function() {
    const opts = { noKey: true };
    const secret = 'some secret message!!!';
    const encrypted = alice.encrypt(secret, opts);
    const decrypted = bob
      .decrypt(encrypted, opts)
      .toString();
    assert.strictEqual(decrypted, secret);
  });

  it('roundtrips (deterministic iv)', function() {
    const opts = { deterministicIv: true };
    const secret = 'some secret message!!!';
    const encrypted = alice.encrypt(secret, opts);
    const decrypted = bob
      .decrypt(encrypted, opts)
      .toString();
    assert.strictEqual(decrypted, secret);
  });

  it('roundtrips (no key mismatch)', function() {
    const opts1 = { noKey: true };
    const opts2 = { noKey: false };
    const secret = 'some secret message!!!';
    const encrypted1 = alice.encrypt(secret, opts1);
    const encrypted2 = alice.encrypt(secret, opts2);
    assert.notEqual(encrypted1.toString('hex'), encrypted2.toString('hex'));
    assert.throws(() => {
      bob
        .decrypt(encrypted1, opts2) // intentionally mismatched
        .toString();
    }, 'Invalid type'); // Generic error since it's not really possible to know _why_ it failed (could be false positive if valid type?)
    assert.throws(() => {
      bob
        .decrypt(encrypted2, opts1) // intentionally mismatched
        .toString();
    }, 'Invalid type'); // Generic error since it's not really possible to know _why_ it failed (could be false positive if valid type?)
  });

  it('correctly fails if trying to decrypt a bad message', function() {
    const encrypted = Buffer.from(encBuf);
    encrypted[encrypted.length - 1] = 2;
    assert.throws(() => bob.decrypt(encrypted), { message: 'Invalid checksum' });
  });

  describe('failure / attack vectors', function() {
    it('rejects a non-Buffer payload', function() {
      assert.throws(
        () => ECIES.decrypt({ payload: 'not a buffer', privateKey: bobKey }),
        /payload must be a Buffer/
      );
    });

    it('rejects encrypt without a message', function() {
      assert.throws(
        () => ECIES.encrypt({ message: null, privateKey: aliceKey, publicKey: bobKey.publicKey }),
        /message is required/
      );
    });

    it('rejects encrypt without a publicKey', function() {
      assert.throws(
        () => ECIES.encrypt({ message: 'hi', privateKey: aliceKey, publicKey: null }),
        /publicKey is required/
      );
    });

    it('rejects encrypt without a privateKey', function() {
      assert.throws(
        () => ECIES.encrypt({ message: 'hi', privateKey: null, publicKey: bobKey.publicKey }),
        /privateKey is required/
      );
    });

    it('rejects encrypt with an ivbuf of wrong length', function() {
      assert.throws(
        () => ECIES.encrypt({ message: 'hi', privateKey: aliceKey, publicKey: bobKey.publicKey, ivbuf: Buffer.alloc(15) }),
        /ivbuf must be 16 bytes/
      );
    });

    it('rejects a payload with an invalid public key prefix byte', function() {
      const bad = Buffer.from(encBuf);
      bad[0] = 0x01; // not 02/03/04
      assert.throws(() => bob.decrypt(bad), /Invalid type/);
    });

    it('rejects a truncated payload (too short)', function() {
      const truncated = encBuf.subarray(0, 10);
      assert.throws(() => bob.decrypt(truncated));
    });

    it('rejects when IV bytes are tampered', function() {
      // For standard format: [33-byte pubkey][16-byte IV][ciphertext][32-byte tag]
      const tampered = Buffer.from(encBuf);
      tampered[33] ^= 0xff; // flip all bits in first IV byte
      assert.throws(() => bob.decrypt(tampered), { message: 'Invalid checksum' });
    });

    it('rejects when ciphertext bytes are tampered', function() {
      // ciphertext begins at byte 33+16=49
      const tampered = Buffer.from(encBuf);
      tampered[49] ^= 0xff;
      assert.throws(() => bob.decrypt(tampered), { message: 'Invalid checksum' });
    });

    it('rejects when the first tag byte is tampered', function() {
      const tampered = Buffer.from(encBuf);
      tampered[tampered.length - 32] ^= 0xff;
      assert.throws(() => bob.decrypt(tampered), { message: 'Invalid checksum' });
    });

    it('rejects when bytes are appended to the payload', function() {
      // Appended bytes shift the real tag out of position, so computed tag won't match
      const extended = Buffer.concat([encBuf, Buffer.from([0xde, 0xad])]);
      assert.throws(() => bob.decrypt(extended), { message: 'Invalid checksum' });
    });

    it('rejects decryption by a third party (wrong private key)', function() {
      const eveKey = new PrivateKey();
      const ciphertext = alice.encrypt(message);
      assert.throws(
        () => ECIES.decrypt({ payload: ciphertext, privateKey: eveKey }),
        { message: 'Invalid checksum' }
      );
    });

    it('rejects noKey decryption with the wrong sender public key', function() {
      const eveKey = new PrivateKey();
      const ciphertext = alice.encrypt(message, { noKey: true });
      assert.throws(
        () => ECIES.decrypt({ payload: ciphertext, privateKey: bobKey, publicKey: eveKey.publicKey }),
        { message: 'Invalid checksum' }
      );
    });

    it('deterministic IV produces identical ciphertexts for identical messages (replay risk)', function() {
      const opts = { deterministicIv: true };
      const c1 = alice.encrypt(message, opts);
      const c2 = alice.encrypt(message, opts);
      assert.strictEqual(c1.toString('hex'), c2.toString('hex'));
    });

    it('random IV produces distinct ciphertexts for identical messages', function() {
      const c1 = alice.encrypt(message);
      const c2 = alice.encrypt(message);
      assert.notStrictEqual(c1.toString('hex'), c2.toString('hex'));
    });

    it('KDF output differs when isDecrypt flag is toggled (asymmetric swap)', function() {
      // Same key pair, same direction — flipping isDecrypt changes the salt order,
      // so keys must differ to prevent cross-direction attacks.
      const [kE1] = ECIES.KDF(aliceKey, bobKey.publicKey, false);
      const [kE2] = ECIES.KDF(aliceKey, bobKey.publicKey, true);
      assert.notStrictEqual(kE1.toString('hex'), kE2.toString('hex'));
    });
  });

  it('decrypting uncompressed keys', function() {
    const secret = 'test';

    // test uncompressed
    const alicePrivateKey = new bitcore.PrivateKey.fromObject({
      bn: '1fa76f9c799ca3a51e2c7c901d3ba8e24f6d870beccf8df56faf30120b38f360',
      compressed: false,
      network: 'livenet'
    });
    const alicePublicKey = alicePrivateKey.publicKey;
    assert.strictEqual(alicePrivateKey.compressed, false);
    assert.strictEqual(alicePublicKey.compressed, false);

    const encrypted = ECIES.encrypt({
      message: secret,
      privateKey: alicePrivateKey,
      publicKey: alicePublicKey
    });

    const decrypted = ECIES.decrypt({
      payload: encrypted,
      privateKey: alicePrivateKey
    });
    assert.strictEqual(secret, decrypted.toString());
  });
  
  it('decrypting compressed keys', function() {
    const secret = 'test';

    // test compressed
    const alicePrivateKey = new bitcore.PrivateKey.fromObject({
      bn: '1fa76f9c799ca3a51e2c7c901d3ba8e24f6d870beccf8df56faf30120b38f360',
      compressed: true,
      network: 'livenet'
    });
    const alicePublicKey = alicePrivateKey.publicKey;
    assert.strictEqual(alicePrivateKey.compressed, true);
    assert.strictEqual(alicePublicKey.compressed, true);

    const encrypted = ECIES.encrypt({
      message: secret,
      privateKey: alicePrivateKey,
      publicKey: alicePublicKey
    });

    const decrypted = ECIES.decrypt({
      payload: encrypted,
      privateKey: alicePrivateKey
    });
    assert.strictEqual(secret, decrypted.toString());
  });
});
