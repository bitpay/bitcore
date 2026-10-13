'use strict';

import * as chai from 'chai';
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

  const encrypt = (overrides: Partial<{ context: JoinDeliveryContext; secret: string; creatorPrivKey }> = {}) =>
    encryptJoinDelivery({ context, secret, creatorPrivKey: creatorPriv, ...overrides });
  const decrypt = (delivery, overrides: Partial<{ recipientPrivKey; creatorPubKey: string; expected: JoinDeliveryContext }> = {}) =>
    decryptJoinDelivery({ delivery, recipientPrivKey: recipientPriv, creatorPubKey: creatorPub, expected: context, ...overrides });

  /** Sign and encrypt an arbitrary payload exactly as a creator would, to exercise the recipient's checks */
  const craft = (overrides: Record<string, any>, privKey = creatorPriv) => {
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
      ...overrides
    };
    return TssUtils.encryptAndDetachSignData(Buffer.from(JSON.stringify(payload)), recipientPriv.publicKey, privKey);
  };

  describe('round trip', function() {
    it(happyPath('should deliver the original secret to the intended recipient'), function() {
      decrypt(encrypt()).should.equal(secret);
    });

    it('should produce different ciphertext each time that decrypts to the same secret', function() {
      const first = encrypt();
      const second = encrypt();
      first.encryptedMessage.should.not.equal(second.encryptedMessage);
      decrypt(first).should.equal(secret);
      decrypt(second).should.equal(secret);
    });

    it('should accept equivalent public key encodings', function() {
      const uncompressed = (key: BitcoreLib.PrivateKey) => BitcoreLib.PublicKey.fromPoint(key.publicKey.point, false).toString();
      const delivery = encrypt({ context: { ...context, requestPubKey: uncompressed(recipientPriv).toUpperCase() } });
      decrypt(delivery, { creatorPubKey: uncompressed(creatorPriv) }).should.equal(secret);
    });

    it('should not expose the secret or wallet key in the stored record', function() {
      const delivery = encrypt();
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
      const delivery = encrypt({ context: btcContext, secret: btcSecret });
      decrypt(delivery, { expected: btcContext }).should.equal(btcSecret);
    });
  });

  describe('keys and tampering', function() {
    it('should reject the wrong recipient key', function() {
      should.throw(() => decrypt(encrypt(), { recipientPrivKey: otherPriv }), /could not be decrypted or verified/);
    });

    it('should reject the wrong creator key', function() {
      should.throw(() => decrypt(encrypt(), { creatorPubKey: otherPriv.publicKey.toString() }), /could not be decrypted or verified/);
    });

    it('should reject a delivery encrypted by someone other than the creator', function() {
      should.throw(() => decrypt(encrypt({ creatorPrivKey: otherPriv })), /could not be decrypted or verified/);
    });

    it('should reject a delivery signed by someone other than the creator', function() {
      // Encrypted with the creator's key (so it decrypts), but signed with another key
      const encrypted = encrypt();
      const forged = { ...encrypted, signature: craft({}, otherPriv).signature };
      should.throw(() => decrypt(forged), /could not be decrypted or verified/);
    });

    it('should reject tampered ciphertext', function() {
      const delivery = encrypt();
      const bytes = Buffer.from(delivery.encryptedMessage, 'base64');
      bytes[20] = (bytes[20] + 1) % 256;
      should.throw(() => decrypt({ ...delivery, encryptedMessage: bytes.toString('base64') }), /could not be decrypted or verified/);
    });

    it('should reject a tampered or substituted signature', function() {
      const delivery = encrypt();
      const other = encrypt();
      // A signature over a different message is not valid for this one
      const otherSignature = craft({ sessionId: 'another' }).signature;
      should.throw(() => decrypt({ ...delivery, signature: otherSignature }), /could not be decrypted or verified/);
      should.throw(() => decrypt({ ...delivery, signature: 'not a signature' }), /could not be decrypted or verified/);
      // A signature that is valid for the same plaintext still verifies, since the signature covers the plaintext only
      decrypt({ ...delivery, signature: other.signature }).should.equal(secret);
    });

    it('should reject malformed deliveries', function() {
      for (const bad of [null, undefined, {}, { encryptedMessage: 'abc' }, { signature: 'abc' }, { encryptedMessage: 1, signature: 2 }, 'string']) {
        should.throw(() => decrypt(bad), /Invalid join delivery$/);
      }
      should.throw(() => decrypt({ encryptedMessage: '', signature: '' }), /could not be decrypted or verified/);
    });

    it('should require a valid creator key', function() {
      should.throw(() => decrypt(encrypt(), { creatorPubKey: 'zz' }), /Invalid creatorPubKey/);
      should.throw(() => decrypt(encrypt(), { creatorPubKey: undefined }), /Invalid creatorPubKey/);
    });
  });

  describe('compatibility with the signed encryption helpers', function() {
    it('should produce records that the helpers can decrypt and verify', function() {
      const decrypted = TssUtils.decryptAndVerifySignedData(encrypt(), creatorPub, recipientPriv);
      JSON.parse(Buffer.from(decrypted, 'base64').toString()).secret.should.equal(secret);
    });

    it('should accept records produced by the helpers', function() {
      decrypt(craft({})).should.equal(secret);
    });
  });

  describe('plaintext buffer hygiene', function() {
    const isZeroed = (buf: Buffer) => buf.length > 0 && buf.every(b => b === 0);
    afterEach(function() {
      sandbox.restore();
    });

    it('should zero the plaintext payload after encrypting', function() {
      const encryptSpy = sandbox.spy(TssUtils, 'encrypt');
      encrypt();
      encryptSpy.calledOnce.should.equal(true);
      const plaintext: Buffer = encryptSpy.firstCall.args[0];
      isZeroed(plaintext).should.equal(true);
    });

    it('should zero the plaintext payload if encryption fails', function() {
      const encryptSpy = sandbox.stub(TssUtils, 'encrypt').throws(new Error('boom'));
      should.throw(() => encrypt(), /boom/);
      isZeroed(encryptSpy.firstCall.args[0]).should.equal(true);
    });

    it('should zero the decrypted plaintext after accepting a delivery', function() {
      const delivery = encrypt();
      const decryptSpy = sandbox.spy(TssUtils, 'decrypt');
      decrypt(delivery).should.equal(secret);
      isZeroed(decryptSpy.firstCall.returnValue).should.equal(true);
    });

    it('should zero the decrypted plaintext after every kind of rejection', function() {
      const decryptSpy = sandbox.spy(TssUtils, 'decrypt');
      const rejected = [
        // Signature does not verify
        () => decrypt({ ...encrypt(), signature: craft({ sessionId: 'another' }).signature }),
        () => decrypt({ ...encrypt(), signature: 'not a signature' }),
        // Not JSON
        () => decrypt(TssUtils.encryptAndDetachSignData(Buffer.from('not json'), recipientPriv.publicKey, creatorPriv)),
        // Wrong context, purpose, version and secret
        () => decrypt(craft({ sessionId: 'another' })),
        () => decrypt(craft({ purpose: 'other' })),
        () => decrypt(craft({ version: 2 })),
        () => decrypt(craft({ secret: 'garbage' }))
      ];
      for (const attempt of rejected) {
        attempt.should.throw();
      }
      // Every successful decryption yielded a buffer, and each one was zeroed
      const buffers = decryptSpy.returnValues.filter(Buffer.isBuffer);
      buffers.length.should.equal(rejected.length);
      for (const buf of buffers) {
        isZeroed(buf).should.equal(true);
      }
    });
  });

  describe('authenticated context', function() {
    it('should accept a payload that matches the expected context', function() {
      decrypt(craft({})).should.equal(secret);
    });

    it('should reject the wrong purpose or version', function() {
      should.throw(() => decrypt(craft({ purpose: 'something-else' })), /wrong purpose/);
      should.throw(() => decrypt(craft({ purpose: undefined })), /wrong purpose/);
      should.throw(() => decrypt(craft({ version: 2 })), /Unsupported join delivery version/);
      should.throw(() => decrypt(craft({ version: '1' })), /Unsupported join delivery version/);
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
        should.throw(() => decrypt(craft({ [field]: value })), new RegExp(`${field} does not match`));
      }
    });

    it('should reject a payload with a missing context field', function() {
      for (const field of ['sessionId', 'partyId', 'requestPubKey', 'chain', 'coin', 'network', 'm', 'n', 'commonKeyChain']) {
        should.throw(() => decrypt(craft({ [field]: undefined })), new RegExp(`${field} does not match`));
      }
    });

    it('should reject a delivery for the local context of a different ceremony', function() {
      const delivery = encrypt();
      should.throw(() => decrypt(delivery, { expected: { ...context, sessionId: 'another' } }), /sessionId does not match/);
      should.throw(() => decrypt(delivery, { expected: { ...context, commonKeyChain: 'another' } }), /commonKeyChain does not match/);
      should.throw(() => decrypt(delivery, { expected: { ...context, m: 3 } }), /m does not match/);
    });

    it('should reject payloads that are not an object', function() {
      for (const json of ['null', '"text"', '1', 'not json']) {
        const delivery = TssUtils.encryptAndDetachSignData(Buffer.from(json), recipientPriv.publicKey, creatorPriv);
        should.throw(() => decrypt(delivery), /Invalid join delivery contents/);
      }
    });

    it('should use the coin implied by the chain unless one is expected', function() {
      const tokenContext = { ...context, coin: 'usdc' };
      const tokenSecret = API._buildSecret(walletId, new BitcoreLib.PrivateKey(), 'usdc', 'livenet');
      const delivery = encrypt({ context: tokenContext, secret: tokenSecret });
      decrypt(delivery, { expected: tokenContext }).should.equal(tokenSecret);
      should.throw(() => decrypt(delivery), /coin does not match/);
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
        should.throw(() => decrypt(craft({ secret: badSecret })), /Invalid join secret/);
        // and refuse to produce one
        should.throw(() => encrypt({ secret: badSecret }), /Invalid join secret/);
      });
    }

    it('should reject a shortened wallet ID that the secret parser accepts', function() {
      for (const shortId of ['12345678', '1234-5678', 'abcd', walletId.slice(0, 18), walletId.replace(/-/g, '').slice(0, 30)]) {
        const shortSecret = API._buildSecret(shortId, API.parseSecret(secret).walletPrivKey, 'eth', 'livenet');
        // The ordinary parser and builder round trip it, which is why the format must be checked explicitly
        API.parseSecret(shortSecret).walletId.should.not.equal(walletId);
        should.throw(() => decrypt(craft({ secret: shortSecret })), /Invalid join secret/);
        should.throw(() => encrypt({ secret: shortSecret }), /Invalid join secret/);
      }
    });

    it('should reject trailing data, which would otherwise change the coin', function() {
      should.throw(() => decrypt(craft({ secret: secret + 'x' })), /secret coin does not match/);
      should.throw(() => encrypt({ secret: secret + 'x' }), /secret coin does not match/);
    });

    it('should reject a non-string secret', function() {
      for (const value of [undefined, null, 1, {}, ['x']]) {
        should.throw(() => decrypt(craft({ secret: value })), /Invalid join secret/);
      }
    });

    it('should reject a secret whose coin or network disagrees with the ceremony', function() {
      const btcSecret = API._buildSecret(walletId, new BitcoreLib.PrivateKey(), 'btc', 'livenet');
      const testnetSecret = API._buildSecret(walletId, new BitcoreLib.PrivateKey(), 'eth', 'testnet');
      should.throw(() => decrypt(craft({ secret: btcSecret })), /secret coin does not match/);
      should.throw(() => decrypt(craft({ secret: testnetSecret })), /secret network does not match/);
      should.throw(() => encrypt({ secret: btcSecret }), /secret coin does not match/);
      should.throw(() => encrypt({ secret: testnetSecret }), /secret network does not match/);
    });

    it('should not include the secret in any failure message', function() {
      const attempts = [
        () => decrypt(craft({ secret: secret + 'x' })),
        () => decrypt(craft({ sessionId: 'another' })),
        () => decrypt(encrypt(), { recipientPrivKey: otherPriv }),
        () => encrypt({ secret: secret + 'x' })
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
      should.throw(() => encrypt({ context: { ...context, partyId: 0 } }), /partyId/);
      should.throw(() => encrypt({ context: { ...context, partyId: 3 } }), /partyId/);
      should.throw(() => encrypt({ context: { ...context, m: 4 } }), /m and n/);
      should.throw(() => encrypt({ context: { ...context, sessionId: '' } }), /sessionId/);
      should.throw(() => encrypt({ context: { ...context, commonKeyChain: '' } }), /commonKeyChain/);
      should.throw(() => encrypt({ context: { ...context, requestPubKey: 'zz' } }), /Invalid requestPubKey/);
      should.throw(() => encrypt({ creatorPrivKey: undefined }), /creatorPrivKey/);
    });
  });
});
