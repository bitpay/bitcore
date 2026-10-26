'use strict';

import assert from 'assert';
import * as chai from 'chai';
import sinon from 'sinon';
import { ECDSA, ECIES, utils as TssUtils } from '@bitpay-labs/bitcore-tss';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { Key } from '../src/lib/key';
import { Request } from '../src/lib/request';
import { TssKeyGen } from '../src/lib/tsskey';

const should = chai.should();

describe('TSS keygen instance lifecycle', function() {
  const sandbox = sinon.createSandbox();
  const alreadyStarted = /initialization already started/;
  let tss: TssKeyGen;
  let requestPrivKey: BitcoreLib.PrivateKey;
  let creatorPrivKey: BitcoreLib.PrivateKey;
  let initJoin: sinon.SinonStub;
  let post: sinon.SinonStub;

  const deferred = () => {
    let resolve: (value?: any) => void;
    const promise = new Promise<any>(r => { resolve = r; });
    return { promise, resolve: (value?: any) => resolve(value) };
  };
  const joinCode = () => ECIES.encrypt({
    message: 'recipient-session:1:eth:livenet:2:2:',
    publicKey: tss.getAuthPublicKey(),
    privateKey: creatorPrivKey
  }).toString('hex');
  const start = (role: 'creator' | 'recipient') => role === 'creator'
    ? tss.newKey({ m: 2, n: 2 })
    : tss.joinKey({ code: joinCode() });
  const state = () => ({ id: tss.id, partyId: tss.partyId, m: tss.m, n: tss.n, chain: tss.chain, network: tss.network });
  const rejectBothStarts = async () => {
    const before = state();
    const initCalls = initJoin.callCount;
    const postCalls = post.callCount;
    await assert.rejects(tss.newKey({ m: 1, n: 3 }), alreadyStarted);
    await assert.rejects(tss.joinKey({ code: joinCode() }), alreadyStarted);
    assert.deepStrictEqual(state(), before);
    assert.strictEqual(initJoin.callCount, initCalls);
    assert.strictEqual(post.callCount, postCalls);
  };
  // An authenticated legacy export is enough to exercise restoration without running the DKG.
  const session = () => {
    const dkg = TssUtils.encrypt(Buffer.from('1:2:2:0:session-bytes'), requestPrivKey.publicKey, requestPrivKey).toString('base64');
    return 'restored-session:0:2:2:' + dkg;
  };

  beforeEach(function() {
    const key = new Key({ seedType: 'new' });
    const credentials = key.createCredentials(null, { chain: 'eth', network: 'livenet', n: 1, account: 0 });
    requestPrivKey = new BitcoreLib.PrivateKey(credentials.requestPrivKey);
    creatorPrivKey = new BitcoreLib.PrivateKey();
    tss = new TssKeyGen({ chain: 'eth', network: 'livenet', baseUrl: '/bws/api', key });
    initJoin = sandbox.stub(ECDSA.KeyGen.prototype, 'initJoin').resolves({ round: 0 });
    post = sandbox.stub(Request.prototype, 'post').resolves({ body: {} });
  });

  afterEach(function() {
    tss.unsubscribe();
    sandbox.restore();
  });

  for (const role of ['creator', 'recipient'] as const) {
    it(`should preserve the ${role}'s session and trusted keys when either start method is called again`, async function() {
      await start(role);
      const peerPubKey = creatorPrivKey.publicKey.toString();
      if (role === 'creator') {
        await tss.createJoinCode({ partyId: 1, partyPubKey: peerPubKey });
      }

      await rejectBothStarts();

      tss.verifyDeliveryBindings(role === 'creator'
        ? [tss.getAuthPublicKey(), peerPubKey]
        : [peerPubKey, tss.getAuthPublicKey()]);
    });

    for (const stage of ['DKG initialization', 'enrollment request']) {
      it(`should reject overlapping starts while the ${role} awaits ${stage}`, async function() {
        const pending = deferred();
        (stage === 'DKG initialization' ? initJoin : post).returns(pending.promise);
        const starting = start(role);
        try {
          await Promise.resolve();
          if (stage === 'enrollment request') assert.strictEqual(post.callCount, 1);
          await rejectBothStarts();
          await assert.rejects(tss.restoreSession({ session: session() }), /initialization is in progress/);
        } finally {
          pending.resolve({ round: 0, body: {} });
          await starting;
        }
      });
    }

    for (const stage of ['DKG initialization', 'enrollment request']) {
      it(`should require a fresh instance after the ${role}'s ${stage} fails`, async function() {
        const error = new Error('start failed');
        (stage === 'DKG initialization' ? initJoin : post).rejects(error);
        await assert.rejects(start(role), err => err === error);
        await rejectBothStarts();
      });
    }
  }

  it('should allow a valid start after rejecting an invalid invitation or invalid threshold', async function() {
    await assert.rejects(tss.joinKey({ code: '00' }));
    await assert.rejects(tss.newKey({ m: 0, n: 2 }));
    assert.strictEqual(initJoin.callCount, 0);
    assert.strictEqual(post.callCount, 0);
    assert.strictEqual(await start('recipient'), tss);
  });

  it('should reject starts during and after restoration, while allowing repeated restoration for rollback', async function() {
    const pending = deferred();
    const restore = sandbox.stub(ECDSA.KeyGen, 'restore').returns(pending.promise);
    const restoring = tss.restoreSession({ session: session() });
    try {
      await rejectBothStarts();
      assert.strictEqual(restore.callCount, 1);
    } finally {
      pending.resolve({});
      await restoring;
    }
    await rejectBothStarts();
    assert.strictEqual(await tss.restoreSession({ session: session() }), tss);
    assert.strictEqual(restore.callCount, 2);
  });

  for (const role of ['creator', 'recipient'] as const) {
    it(`should restore the ${role}'s real DKG snapshot for rollback and preserve its trusted keys`, async function() {
      this.timeout(10000);
      initJoin.restore();
      const realInitJoin = sandbox.spy(ECDSA.KeyGen.prototype, 'initJoin');
      await start(role);
      const peerPubKey = creatorPrivKey.publicKey.toString();
      if (role === 'creator') {
        await tss.createJoinCode({ partyId: 1, partyPubKey: peerPubKey });
      }
      const before = state();
      const snapshot = tss.exportSession();
      await tss.restoreSession({ session: snapshot });
      await tss.restoreSession({ session: snapshot });
      assert.deepStrictEqual(state(), before);
      assert.strictEqual(tss.getTssKey(), null);
      tss.verifyDeliveryBindings(role === 'creator'
        ? [tss.getAuthPublicKey(), peerPubKey]
        : [peerPubKey, tss.getAuthPublicKey()]);
      await rejectBothStarts();
      assert.strictEqual(realInitJoin.callCount, 1);
    });
  }

  it('should leave a fresh instance available when DKG restoration fails', async function() {
    sandbox.stub(ECDSA.KeyGen, 'restore').rejects(new Error('restore failed'));
    await assert.rejects(tss.restoreSession({ session: session() }), /restore failed/);
    assert.strictEqual(await start('creator'), tss);
  });
});

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
