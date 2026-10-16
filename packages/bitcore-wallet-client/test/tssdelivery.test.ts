'use strict';

import * as chai from 'chai';
import assert from 'assert';
import sinon from 'sinon';
import { utils as TssUtils } from '@bitpay-labs/bitcore-tss';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { API } from '../src/lib/api';
import {
  decryptJoinDelivery,
  encryptJoinDelivery,
  JOIN_DELIVERY_PURPOSE,
  JOIN_DELIVERY_VERSION,
  type JoinDeliveryContext
} from '../src/lib/tssdelivery';

const should = chai.should();

describe('TSS join delivery', function() {
  const sandbox = sinon.createSandbox();
  const happyPath = testName => `☺ HAPPY PATH - ${testName}`;

  const creatorPriv = new BitcoreLib.PrivateKey();
  const creatorPub = creatorPriv.publicKey.toString();
  const recipientPriv = new BitcoreLib.PrivateKey();
  const otherPriv = new BitcoreLib.PrivateKey();

  const walletId = '2b8d1f0e-6c3a-4d9b-8a7e-5f4c3b2a1d0e';
  const secret = API._buildSecret(walletId, new BitcoreLib.PrivateKey(), 'eth', 'livenet');
  const context: JoinDeliveryContext = {
    sessionId: 'session-id',
    partyId: 1,
    requestPubKey: recipientPriv.publicKey.toString(),
    chain: 'ETH',
    network: 'livenet',
    m: 2,
    n: 3,
    commonKeyChain: 'common-key-chain'
  };

  // A correct delivery's inputs. Tests spread these and write out only the field they vary,
  // e.g. `encryptJoinDelivery({ ...encryptParams, creatorPrivKey: otherPriv })`.
  const encryptParams = { context, secret, creatorPrivKey: creatorPriv };
  const decryptParams = { recipientPrivKey: recipientPriv, creatorPubKey: creatorPub, expected: context };

  /**
   * A delivery whose payload is a correct one with `payloadOverrides` applied, for exercising the recipient's checks.
   * Built with the original `encryptAndDetachSignData` helper rather than `encryptJoinDelivery`, so it can carry payloads that
   * `encryptJoinDelivery` refuses to produce. Signed by `signerPrivKey` (the creator unless given).
   */
  const deliveryWithPayload = (payloadOverrides: Record<string, any>, signerPrivKey = creatorPriv) => {
    const payload = {
      purpose: JOIN_DELIVERY_PURPOSE,
      version: JOIN_DELIVERY_VERSION,
      sessionId: context.sessionId,
      partyId: context.partyId,
      requestPubKey: context.requestPubKey,
      chain: 'eth',
      coin: 'eth',
      network: context.network,
      m: context.m,
      n: context.n,
      commonKeyChain: context.commonKeyChain,
      secret,
      ...payloadOverrides
    };
    return TssUtils.encryptAndDetachSignData(Buffer.from(JSON.stringify(payload)), recipientPriv.publicKey, signerPrivKey);
  };

  describe('round trip', function() {
    it(happyPath('should deliver the original secret to the intended recipient'), function() {
      const delivery = encryptJoinDelivery({ context, secret, creatorPrivKey: creatorPriv });
      const received = decryptJoinDelivery({
        delivery,
        recipientPrivKey: recipientPriv,
        creatorPubKey: creatorPub,
        expected: context
      });
      received.should.equal(secret);
    });

    it('should produce different ciphertext each time that decrypts to the same secret', function() {
      const first = encryptJoinDelivery(encryptParams);
      const second = encryptJoinDelivery(encryptParams);
      first.encryptedMessage.should.not.equal(second.encryptedMessage);
      decryptJoinDelivery({ ...decryptParams, delivery: first }).should.equal(secret);
      decryptJoinDelivery({ ...decryptParams, delivery: second }).should.equal(secret);
    });

    it('should accept equivalent public key encodings', function() {
      const uncompressed = (key: BitcoreLib.PrivateKey) => BitcoreLib.PublicKey.fromPoint(key.publicKey.point, false).toString();
      const delivery = encryptJoinDelivery({ ...encryptParams, context: { ...context, requestPubKey: uncompressed(recipientPriv).toUpperCase() } });
      decryptJoinDelivery({ ...decryptParams, delivery, creatorPubKey: uncompressed(creatorPriv) }).should.equal(secret);
    });

    it('should not expose the secret or wallet key in the stored record', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      const stored = JSON.stringify(delivery);
      const walletPrivKey = API.parseSecret(secret).walletPrivKey;
      for (const sensitive of [secret, walletPrivKey.toWIF(), walletPrivKey.toString(), walletId]) {
        stored.should.not.include(sensitive);
        Buffer.from(delivery.encryptedMessage, 'base64').toString('latin1').should.not.include(sensitive);
      }
      Object.keys(delivery).sort().should.deep.equal(['encryptedMessage', 'signature']);
    });

    it('should accept an ordinary secret for a different supported coin and network', function() {
      const btcSecret = API._buildSecret(walletId, new BitcoreLib.PrivateKey(), 'btc', 'testnet');
      const btcContext = { ...context, chain: 'BTC', network: 'testnet' };
      const delivery = encryptJoinDelivery({ ...encryptParams, context: btcContext, secret: btcSecret });
      decryptJoinDelivery({ ...decryptParams, delivery, expected: btcContext }).should.equal(btcSecret);
    });
  });

  describe('keys and tampering', function() {
    it('should reject the wrong recipient key', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery, recipientPrivKey: otherPriv }), /could not be decrypted$/);
    });

    it('should reject the wrong creator key', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery, creatorPubKey: otherPriv.publicKey.toString() }), /could not be decrypted$/);
    });

    it('should reject a delivery encrypted by someone other than the creator', function() {
      const delivery = encryptJoinDelivery({ ...encryptParams, creatorPrivKey: otherPriv });
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery }), /could not be decrypted$/);
    });

    it('should reject a delivery signed by someone other than the creator', function() {
      // Encrypted with the creator's key (so it decrypts), but signed with another key
      const delivery = encryptJoinDelivery(encryptParams);
      const forged = { ...delivery, signature: deliveryWithPayload({}, otherPriv).signature };
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: forged }), /signature verification failed$/);
    });

    it('should reject tampered ciphertext', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      const bytes = Buffer.from(delivery.encryptedMessage, 'base64');
      bytes[20] = (bytes[20] + 1) % 256;
      const tampered = { ...delivery, encryptedMessage: bytes.toString('base64') };
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: tampered }), /could not be decrypted$/);
    });

    it('should reject a tampered or substituted signature', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      const sameContentDelivery = encryptJoinDelivery(encryptParams);
      // A signature over a different message is not valid for this one
      const otherMessageSignature = deliveryWithPayload({ sessionId: 'another' }).signature;
      const wrongSignature = { ...delivery, signature: otherMessageSignature };
      const notASignature = { ...delivery, signature: 'not a signature' };
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: wrongSignature }), /signature verification failed$/);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: notASignature }), /Invalid join delivery signature$/);
      // A signature over the same plaintext still verifies, since the signature covers the plaintext only
      const swapped = { ...delivery, signature: sameContentDelivery.signature };
      decryptJoinDelivery({ ...decryptParams, delivery: swapped }).should.equal(secret);
    });

    it('should reject malformed deliveries', function() {
      for (const bad of [null, undefined, {}, { encryptedMessage: 'abc' }, { signature: 'abc' }, { encryptedMessage: 1, signature: 2 }, 'string']) {
        should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: bad as any }), /Invalid join delivery$/);
      }
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: { encryptedMessage: '', signature: '' } }), /could not be decrypted$/);
    });

    it('should require a valid creator key', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery, creatorPubKey: 'zz' }), /Invalid creatorPubKey/);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery, creatorPubKey: undefined }), /Invalid creatorPubKey/);
    });
  });

  describe('decryption error handling', function() {
    afterEach(function() {
      sandbox.restore();
    });

    for (const malformed of [false, true]) {
      it(`should reject a ${malformed ? 'malformed' : 'mismatched'} signature before parsing the plaintext`, function() {
        const delivery = TssUtils.encryptAndDetachSignData(Buffer.from('not json'), recipientPriv.publicKey, creatorPriv);
        delivery.signature = malformed ? 'not a signature' : deliveryWithPayload({}).signature;
        const parseSpy = sandbox.spy(JSON, 'parse');

        assert.throws(() => decryptJoinDelivery({ ...decryptParams, delivery }));
        parseSpy.called.should.equal(false);
      });
    }

    it('should sanitize malformed JSON errors and zero the decrypted plaintext', function() {
      const malformedJson = JSON.stringify({ secret }) + ' trailing data';
      const delivery = TssUtils.encryptAndDetachSignData(Buffer.from(malformedJson), recipientPriv.publicKey, creatorPriv);
      const decryptSpy = sandbox.spy(TssUtils, 'decrypt');

      assert.throws(() => decryptJoinDelivery({ ...decryptParams, delivery }), (err: Error) => {
        err.message.should.equal('Invalid join delivery contents');
        should.not.exist(err['cause']);
        String(err.stack).should.not.include(secret);
        return true;
      });
      decryptSpy.firstCall.returnValue.every(b => b === 0).should.equal(true);
    });

    it('should preserve unexpected verification errors and zero the decrypted plaintext', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      const failure = new Error('Unexpected verifier failure');
      sandbox.stub(BitcoreLib.crypto.ECDSA, 'verify').throws(failure);
      const decryptSpy = sandbox.spy(TssUtils, 'decrypt');
      const parseSpy = sandbox.spy(JSON, 'parse');

      assert.throws(() => decryptJoinDelivery({ ...decryptParams, delivery }), err => err === failure);
      parseSpy.called.should.equal(false);
      decryptSpy.firstCall.returnValue.every(b => b === 0).should.equal(true);
    });
  });

  describe('compatibility with the signed encryption helpers', function() {
    it('should produce records that the helpers can decrypt and verify', function() {
      const decrypted = TssUtils.decryptAndVerifySignedData(encryptJoinDelivery(encryptParams), creatorPub, recipientPriv);
      JSON.parse(Buffer.from(decrypted, 'base64').toString()).secret.should.equal(secret);
    });

    it('should accept records produced by the helpers', function() {
      decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({}) }).should.equal(secret);
    });
  });

  describe('plaintext buffer hygiene', function() {
    const isZeroed = (buf: Buffer) => buf.length > 0 && buf.every(b => b === 0);
    afterEach(function() {
      sandbox.restore();
    });

    it('should zero the plaintext payload after encrypting', function() {
      const encryptSpy = sandbox.spy(TssUtils, 'encrypt');
      encryptJoinDelivery(encryptParams);
      encryptSpy.calledOnce.should.equal(true);
      const plaintext: Buffer = encryptSpy.firstCall.args[0];
      isZeroed(plaintext).should.equal(true);
    });

    it('should zero the plaintext payload if encryption fails', function() {
      const encryptSpy = sandbox.stub(TssUtils, 'encrypt').throws(new Error('boom'));
      should.throw(() => encryptJoinDelivery(encryptParams), /boom/);
      isZeroed(encryptSpy.firstCall.args[0]).should.equal(true);
    });

    it('should zero the decrypted plaintext after accepting a delivery', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      const decryptSpy = sandbox.spy(TssUtils, 'decrypt');
      decryptJoinDelivery({ ...decryptParams, delivery }).should.equal(secret);
      isZeroed(decryptSpy.firstCall.returnValue).should.equal(true);
    });

    it('should zero the decrypted plaintext after every kind of rejection', function() {
      const decryptSpy = sandbox.spy(TssUtils, 'decrypt');
      const validDelivery = encryptJoinDelivery(encryptParams);
      const rejectedDeliveries = [
        // Signature does not verify
        { ...validDelivery, signature: deliveryWithPayload({ sessionId: 'another' }).signature },
        { ...validDelivery, signature: 'not a signature' },
        // Not JSON
        TssUtils.encryptAndDetachSignData(Buffer.from('not json'), recipientPriv.publicKey, creatorPriv),
        // Wrong context, purpose, version and secret
        deliveryWithPayload({ sessionId: 'another' }),
        deliveryWithPayload({ purpose: 'other' }),
        deliveryWithPayload({ version: 2 }),
        deliveryWithPayload({ secret: 'garbage' })
      ];
      for (const delivery of rejectedDeliveries) {
        should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery }));
      }
      // Each of those decrypted before being rejected, and every decrypted buffer was zeroed
      const buffers = decryptSpy.returnValues.filter(Buffer.isBuffer);
      buffers.length.should.equal(rejectedDeliveries.length);
      for (const buf of buffers) {
        isZeroed(buf).should.equal(true);
      }
    });
  });

  describe('authenticated context', function() {
    it('should accept a payload that matches the expected context', function() {
      decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({}) }).should.equal(secret);
    });

    it('should reject the wrong purpose or version', function() {
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ purpose: 'something-else' }) }), /wrong purpose/);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ purpose: undefined }) }), /wrong purpose/);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ version: 2 }) }), /Unsupported join delivery version/);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ version: '1' }) }), /Unsupported join delivery version/);
    });

    it('should reject a delivery for another session, recipient or ceremony', function() {
      const cases: Array<[string, any]> = [
        ['sessionId', 'another-session'],
        ['partyId', 2],
        ['requestPubKey', otherPriv.publicKey.toString()],
        ['chain', 'btc'],
        ['coin', 'btc'],
        ['network', 'testnet'],
        ['m', 1],
        ['n', 2],
        ['commonKeyChain', 'another-common-key-chain']
      ];
      for (const [field, value] of cases) {
        should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ [field]: value }) }), new RegExp(`${field} does not match`));
      }
    });

    it('should reject a payload with a missing context field', function() {
      for (const field of ['sessionId', 'partyId', 'requestPubKey', 'chain', 'coin', 'network', 'm', 'n', 'commonKeyChain']) {
        should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ [field]: undefined }) }), new RegExp(`${field} does not match`));
      }
    });

    it('should reject a delivery for the local context of a different ceremony', function() {
      const delivery = encryptJoinDelivery(encryptParams);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery, expected: { ...context, sessionId: 'another' } }), /sessionId does not match/);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery, expected: { ...context, commonKeyChain: 'another' } }), /commonKeyChain does not match/);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery, expected: { ...context, m: 3 } }), /m does not match/);
    });

    it('should reject payloads that are not an object', function() {
      for (const json of ['null', '"text"', '1', 'not json']) {
        const delivery = TssUtils.encryptAndDetachSignData(Buffer.from(json), recipientPriv.publicKey, creatorPriv);
        should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery }), /Invalid join delivery contents/);
      }
    });

    it('should use the coin implied by the chain unless one is expected', function() {
      const tokenContext = { ...context, coin: 'usdc' };
      const tokenSecret = API._buildSecret(walletId, new BitcoreLib.PrivateKey(), 'usdc', 'livenet');
      const delivery = encryptJoinDelivery({ ...encryptParams, context: tokenContext, secret: tokenSecret });
      decryptJoinDelivery({ ...decryptParams, delivery, expected: tokenContext }).should.equal(tokenSecret);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery }), /coin does not match/);
    });
  });

  describe('secret validation', function() {
    const wif = API.parseSecret(secret).walletPrivKey.toWIF();
    const bad: Array<[string, string]> = [
      ['a garbage secret', 'garbage'],
      ['an empty secret', ''],
      ['a truncated secret', secret.slice(0, 40)],
      ['an unknown network character', secret.replace(/L(?=eth$)/, 'X')],
      ['a secret with no coin', secret.slice(0, -3)],
      ['an invalid wallet ID', 'I'.repeat(22) + wif + 'Leth']
    ];

    for (const [name, badSecret] of bad) {
      it(`should reject ${name}`, function() {
        should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ secret: badSecret }) }), /Invalid join secret/);
        // and refuse to produce one
        should.throw(() => encryptJoinDelivery({ ...encryptParams, secret: badSecret }), /Invalid join secret/);
      });
    }

    it('should reject a shortened wallet ID that the secret parser accepts', function() {
      for (const shortId of ['12345678', '1234-5678', 'abcd', walletId.slice(0, 18), walletId.replace(/-/g, '').slice(0, 30)]) {
        const shortSecret = API._buildSecret(shortId, API.parseSecret(secret).walletPrivKey, 'eth', 'livenet');
        // The ordinary parser and builder round trip it, which is why the format must be checked explicitly
        API.parseSecret(shortSecret).walletId.should.not.equal(walletId);
        should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ secret: shortSecret }) }), /Invalid join secret/);
        should.throw(() => encryptJoinDelivery({ ...encryptParams, secret: shortSecret }), /Invalid join secret/);
      }
    });

    it('should reject trailing data, which would otherwise change the coin', function() {
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ secret: secret + 'x' }) }), /secret coin does not match/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, secret: secret + 'x' }), /secret coin does not match/);
    });

    it('should reject a non-string secret', function() {
      for (const value of [undefined, null, 1, {}, ['x']]) {
        should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ secret: value }) }), /Invalid join secret/);
      }
    });

    it('should reject a secret whose coin or network disagrees with the ceremony', function() {
      const btcSecret = API._buildSecret(walletId, new BitcoreLib.PrivateKey(), 'btc', 'livenet');
      const testnetSecret = API._buildSecret(walletId, new BitcoreLib.PrivateKey(), 'eth', 'testnet');
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ secret: btcSecret }) }), /secret coin does not match/);
      should.throw(() => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ secret: testnetSecret }) }), /secret network does not match/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, secret: btcSecret }), /secret coin does not match/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, secret: testnetSecret }), /secret network does not match/);
    });

    it('should not include the secret in any failure message', function() {
      const attempts = [
        () => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ secret: secret + 'x' }) }),
        () => decryptJoinDelivery({ ...decryptParams, delivery: deliveryWithPayload({ sessionId: 'another' }) }),
        () => decryptJoinDelivery({ ...decryptParams, delivery: encryptJoinDelivery(encryptParams), recipientPrivKey: otherPriv }),
        () => encryptJoinDelivery({ ...encryptParams, secret: secret + 'x' })
      ];
      for (const attempt of attempts) {
        let error: Error;
        try {
          attempt();
        } catch (err) {
          error = err;
        }
        should.exist(error);
        error.message.should.not.include(secret);
        error.message.should.not.include(secret.slice(22, 74));
      }
    });
  });

  describe('encryption inputs', function() {
    it('should require valid context', function() {
      should.throw(() => encryptJoinDelivery({ ...encryptParams, context: { ...context, partyId: 0 } }), /partyId/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, context: { ...context, partyId: 3 } }), /partyId/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, context: { ...context, m: 4 } }), /m and n/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, context: { ...context, sessionId: '' } }), /sessionId/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, context: { ...context, commonKeyChain: '' } }), /commonKeyChain/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, context: { ...context, requestPubKey: 'zz' } }), /Invalid requestPubKey/);
      should.throw(() => encryptJoinDelivery({ ...encryptParams, creatorPrivKey: undefined }), /creatorPrivKey/);
    });
  });
});
