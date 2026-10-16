'use strict';

import assert from 'assert';
import * as chai from 'chai';
import sinon from 'sinon';
import { ECDSA, utils as TssUtils } from '@bitpay-labs/bitcore-tss';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { Key } from '../src/lib/key';
import { TssKeyGen } from '../src/lib/tsskey';

const should = chai.should();

describe('TSS keygen session parameters', function() {
  const sandbox = sinon.createSandbox();
  const happyPath = testName => `☺ HAPPY PATH - ${testName}`;
  const seed = Buffer.from('sensitive seed must remain in the buffer').toString('base64');
  const remainingFields = ['session-bytes', 'chain-code-commitment', seed].join(':');
  let tss: TssKeyGen;
  let requestPrivKey: BitcoreLib.PrivateKey;

  // Encrypt arbitrary DKG contents so malformed headers reach the parser after real decryption.
  const sessionWithPlaintext = (plaintext: string, params = { n: 3, m: 2, partyId: 0 }) => {
    const encrypted = TssUtils.encrypt(Buffer.from(plaintext), requestPrivKey.publicKey, requestPrivKey).toString('base64');
    return ['session-id', params.partyId, params.m, params.n, encrypted].join(':');
  };

  beforeEach(function() {
    const key = new Key({ seedType: 'new' });
    const credentials = key.createCredentials(null, { chain: 'eth', network: 'livenet', n: 1, account: 0 });
    requestPrivKey = new BitcoreLib.PrivateKey(credentials.requestPrivKey);
    tss = new TssKeyGen({ chain: 'eth', network: 'livenet', baseUrl: '/bws/api', key });
    // The DKG loader has its own tests; these tests exercise the parameter check that precedes it.
    sandbox.stub(ECDSA.KeyGen, 'restore').resolves({});
  });

  afterEach(function() {
    sandbox.restore();
  });

  it(happyPath('should read multi-digit parameters after skipping the round'), async function() {
    const params = { n: 15, m: 10, partyId: 14 };
    const session = sessionWithPlaintext('12:15:10:14:' + remainingFields, params);

    await tss.restoreSession({ session });

    tss.id.should.equal('session-id');
    tss.n.should.equal(15);
    tss.m.should.equal(10);
    tss.partyId.should.equal(14);
    (ECDSA.KeyGen.restore as sinon.SinonStub).calledOnce.should.equal(true);
  });

  it('should stringify only the header without the seed or remaining DKG fields', async function() {
    const header = '0:3:2:0';
    const session = sessionWithPlaintext(header + ':' + remainingFields);
    const toStringSpy = sandbox.spy(Buffer.prototype, 'toString');

    await tss.restoreSession({ session });
    toStringSpy.restore();

    toStringSpy.returnValues.should.include(header);
    for (const value of toStringSpy.returnValues) {
      for (const sensitive of remainingFields.split(':')) {
        value.should.not.include(sensitive);
      }
    }
  });

  it('should zero the decrypted plaintext after reading valid parameters', async function() {
    const session = sessionWithPlaintext('0:3:2:0:' + remainingFields);
    const decryptSpy = sandbox.spy(TssUtils, 'decrypt');

    await tss.restoreSession({ session });

    decryptSpy.calledOnce.should.equal(true);
    decryptSpy.firstCall.returnValue.every(b => b === 0).should.equal(true);
  });

  for (const { name, plaintext } of [
    { name: 'that is empty', plaintext: '' },
    { name: 'without any delimiters', plaintext: '0' },
    { name: 'with only one delimiter', plaintext: '0:3' },
    { name: 'with only two delimiters', plaintext: '0:3:2' },
    { name: 'without the delimiter after partyId', plaintext: '0:3:2:0' }
  ]) {
    it(`should reject a header ${name} and zero the decrypted plaintext`, async function() {
      const session = sessionWithPlaintext(plaintext);
      const decryptSpy = sandbox.spy(TssUtils, 'decrypt');

      await assert.rejects(tss.restoreSession({ session }), { message: 'Session could not be decrypted or verified' });

      decryptSpy.calledOnce.should.equal(true);
      decryptSpy.firstCall.returnValue.every(b => b === 0).should.equal(true);
      (ECDSA.KeyGen.restore as sinon.SinonStub).called.should.equal(false);
      should.not.exist(tss.id);
    });
  }

  it('should zero the decrypted plaintext when its parameters disagree with the outer session', async function() {
    const session = sessionWithPlaintext('0:4:2:0:' + remainingFields);
    const decryptSpy = sandbox.spy(TssUtils, 'decrypt');

    await assert.rejects(tss.restoreSession({ session }), { message: 'Session ceremony parameters do not match its DKG state' });

    decryptSpy.firstCall.returnValue.every(b => b === 0).should.equal(true);
    (ECDSA.KeyGen.restore as sinon.SinonStub).called.should.equal(false);
    should.not.exist(tss.id);
  });
});
