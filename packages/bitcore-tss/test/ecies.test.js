'use strict';

// const { describe, it } = require('node:test');
const assert = require('assert');
const bitcore = require('@bitpay-labs/bitcore-lib');
const ECIES = require('../ecies/ecies');

const PrivateKey = bitcore.PrivateKey;

describe('ECIES', function() {
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
  const encrypted = '0339e504d6492b082da96e11e8f039796b06cd4855c101e2492a6f10f3e056a9e712c732611c6917ab5c57a1926973bc44a1586e94a783f81d05ce72518d9b0a804ef5cf06e78bacf8fa1751e3dfd68a507dff5b0527ddfa91de9c293d2d6de920';
  const encBuf = Buffer.from(encrypted, 'hex');
  const encryptedNoKey = '12c732611c6917ab5c57a1926973bc44a1586e94a783f81d05ce72518d9b0a804ef5cf06e78bacf8fa1751e3dfd68a507dff5b0527ddfa91de9c293d2d6de920';
  const encNoKeyBuf = Buffer.from(encryptedNoKey, 'hex');
  const encryptedShortTag = '0339e504d6492b082da96e11e8f039796b06cd4855c101e2492a6f10f3e056a9e712c732611c6917ab5c57a1926973bc44a1586e94a783f81d05ce72518d9b0a804ef5cf06';
  const encShortTagBuf = Buffer.from(encryptedShortTag, 'hex');

  describe('KDF', function() {
    it('should generate the same keys', function() {
      const [kE1, kM1] = ECIES.KDF(aliceKey, bobKey.publicKey);
      const [kE2, kM2] = ECIES.KDF(bobKey, aliceKey.publicKey);
      assert.strictEqual(kE1.toString('hex'), kE2.toString('hex'));
      assert.strictEqual(kM1.toString('hex'), kM2.toString('hex'));
    });
  });

  it('correctly encrypts a message', function() {
    const ciphertext = alice.encrypt(message, { deterministicIv: true });
    assert.strictEqual(Buffer.isBuffer(ciphertext), true);
    assert.strictEqual(ciphertext.toString('hex'), encrypted)
  });

  it('correctly decrypts a message', function() {
    const decrypted = bob.decrypt(encBuf);
    assert.strictEqual(Buffer.isBuffer(decrypted), true);
    assert.strictEqual(decrypted.toString(), message);
  });

  it('correctly encrypts a message without key', function() {
    const ciphertext = alice.encrypt(message, { noKey: true, deterministicIv: true });
    assert.strictEqual(Buffer.isBuffer(ciphertext), true);
    assert.strictEqual(ciphertext.toString('hex'), encryptedNoKey)
  });

  it('correctly decrypts a message without key', function() {
    const decrypted = bob.decrypt(encNoKeyBuf, { noKey: true, deterministicIv: true });
    assert.strictEqual(Buffer.isBuffer(decrypted), true);
    assert.strictEqual(decrypted.toString(), message);
  });

  it('correctly encrypts a message with short tag', function() {
    const ciphertext = alice.encrypt(message, { shortTag: true, deterministicIv: true });
    assert.strictEqual(Buffer.isBuffer(ciphertext), true);
    assert.strictEqual(ciphertext.toString('hex'), encryptedShortTag)
  });

  it('correctly decrypts a message with short tag', function() {
    const decrypted = bob.decrypt(encShortTagBuf, { shortTag: true, deterministicIv: true });
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

  it('roundtrips (short tag)', function() {
    const opts = { shortTag: true };
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

  it('roundtrips (no public key & short tag)', function() {
    const opts = { noKey: true, shortTag: true };
    const secret = 'some secret message!!!';
    const encrypted = alice.encrypt(secret, opts);
    const decrypted = bob
      .decrypt(encrypted, opts)
      .toString();
    assert.strictEqual(decrypted, secret);
  });

  it('roundtrips (short tag mismatch)', function() {
    const opts1 = { shortTag: true };
    const opts2 = { shortTag: false };
    const secret = 'some secret message!!!';
    const encrypted1 = alice.encrypt(secret, opts1);
    const encrypted2 = alice.encrypt(secret, opts2);
    assert.notEqual(encrypted1.toString('hex'), encrypted2.toString('hex'));
    assert.throws(() => {
      bob
        .decrypt(encrypted1, opts2) // intentionally mismatched
        .toString();
    }, { message: 'Invalid checksum' });
    assert.throws(() => {
      bob
        .decrypt(encrypted2, opts1) // intentionally mismatched
        .toString();
    }, { message: 'Invalid checksum' });
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
