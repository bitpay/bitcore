'use strict';

import sinon from 'sinon';
import * as chai from 'chai';
import BWS from '@bitpay-labs/bitcore-wallet-service';
import { Defaults as BwsDefaults } from '@bitpay-labs/bitcore-wallet-service/ts_build/src/lib/common/defaults';
import {
  TssKeyGen as BwsTssKeyGen,
  TssSign as BwsTssSign
} from '@bitpay-labs/bitcore-wallet-service/ts_build/src/lib/tss';
import request from 'supertest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ECIES, utils as TssUtils } from '@bitpay-labs/bitcore-tss';
import { Request } from '../src/lib/request';
import { BitcoreLib, Deriver } from '@bitpay-labs/crypto-wallet-core';
import { TssKeyGen, TssKey } from '../src/lib/tsskey';
import { TssSign } from '../src/lib/tsssign';
import log from '../src/lib/log';
import Client, { type Credentials } from '../src';
import {
  helpers,
  blockchainExplorerMock
} from './helpers';
import type { IErrorSpec } from '../src/lib/errors/spec';

const should = chai.should();
const datadir = path.join(__dirname, 'data');
const Key = Client.Key;

describe('TSS', function() {
  this.timeout(Math.max(this['_timeout'], 10000));

  const happyPath = testName => `\u263A HAPPY PATH - ${testName}`;

  let db;
  let storage;
  let dbConnection;
  let app;
  const sandbox = sinon.createSandbox();
  const chain = 'ETH';
  const network = 'livenet';
  const m = 2;
  const n = 3;
  const derivationPath = Deriver.pathFor(chain, network);

  before(function(done) {
    helpers.newDb(null, (err, database, connection) => {
      dbConnection = connection;
      db = database;
      storage = new BWS.Storage({ db });
      BWS.Storage.createIndexes(db);

      const expressApp = new BWS.ExpressApp();
      expressApp.start(
        {
          ignoreRateLimiter: true,
          storage: storage,
          blockchainExplorer: blockchainExplorerMock,
          disableLogs: true,
          doNotCheckV8: true
        },
        () => {
          app = expressApp.app;

          if (!process.env.BWC_SHOW_LOGS) {
            sandbox.stub(log, 'warn');
            sandbox.stub(log, 'info');
            sandbox.stub(log, 'error');
          }
          done();
        }
      );
    });
  });

  beforeEach(function() {
    sandbox.stub(BwsTssKeyGen, 'getMessagesForParty').callsFake(async function(params) {
      params.maxWaitTimeSec = 1;
      return (BwsTssKeyGen.getMessagesForParty as any).wrappedMethod.call(this, params);
    });
    sandbox.stub(BwsTssSign, 'getMessagesForParty').callsFake(async function(params) {
      params.maxWaitTimeSec = 1;
      return (BwsTssSign.getMessagesForParty as any).wrappedMethod.call(this, params);
    });
  });

  after(function(done) {
    dbConnection.close(done);
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('Key Generation', function() {
    const party0Key = new Key({ seedType: 'new' });
    const party1Key = new Key({ seedType: 'new' });
    const party2Key = new Key({ seedType: 'new' });
    let tss0: TssKeyGen;
    let tss1: TssKeyGen;
    let tss2: TssKeyGen;
    let joinCode1: string;
    let joinCode2: string;

    afterEach(function() {
      tss0?.unsubscribe();
      tss1?.unsubscribe();
      tss2?.unsubscribe();
    });

    it(happyPath('should instantiate a new TssKeyGen class'), function() {
      tss0 = new TssKeyGen({
        chain,
        network,
        baseUrl: '/bws/api',
        request: request(app),
        key: party0Key
      });
      should.exist(tss0);
      tss0.should.be.instanceOf(TssKeyGen);
    });

    it(happyPath('should start a new keygen session'), async function() {
      const result = await tss0.newKey({ m, n });
      should.exist(result);
      result.should.equal(tss0);
      tss0.id.should.be.a('string');
      const chainXpriv = BitcoreLib.HDPrivateKey.fromString(party0Key.get().xPrivKey).deriveChild(derivationPath);
      const seed = crypto.createHash('sha256').update(chainXpriv.toBuffer()).digest();
      tss0.id.should.equal(crypto.createHash('sha256').update(crypto.createHash('sha256').update(seed).digest()).digest('hex'));
      tss0.m.should.equal(m);
      tss0.n.should.equal(n);
      tss0.partyId.should.equal(0);
    });

    it(happyPath('should create a join code'), async function() {
      const code1 = await tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
      });
      should.exist(code1);
      code1.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code1).should.equal(true);
      joinCode1 = code1;

      const code2 = await tss0.createJoinCode({
        partyId: 2,
        partyPubKey: party2Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
      });
      should.exist(code2);
      code2.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code2).should.equal(true);
      joinCode2 = code2;
    });

    it('should not produce a deterministic join code', async function() {
      const code = await tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
      });
      should.exist(code);
      code.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code).should.equal(true);
      code.should.not.equal(joinCode1);
    });

    it('should encode the join code per the encoding option', async function() {
      const code = await tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey,
        opts: { encoding: 'base64' }
      });
      should.exist(code);
      code.should.be.a('string');
      code.should.not.equal(joinCode1);
      BitcoreLib.util.js.isHexaString(code).should.equal(false);
    });

    it('should not allow other party to use join code', async function() {
      try {
        const tss = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party0Key
        });
        // party0 should not be able to use party1's join code
        const result = await tss.joinKey({ code: joinCode1 });
        throw new Error('Should not have been able to join');
      } catch (err) {
        err.message.should.equal('Invalid checksum');
      }

      try {
        const tss = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party2Key
        });
        // party2 should not be able to use party1's join code
        const result = await tss.joinKey({ code: joinCode1 });
        throw new Error('Should not have been able to join');
      } catch (err) {
        err.message.should.equal('Invalid checksum');
      }
    });

    it(happyPath('should use the join code to join a keygen session'), async function() {
      // party 1
      tss1 = new TssKeyGen({
        chain,
        network,
        baseUrl: '/bws/api',
        request: request(app),
        key: party1Key
      });
      let result = await tss1.joinKey({ code: joinCode1 });
      should.exist(result);
      result.should.equal(tss1);
      tss1.id.should.equal(tss0.id);
      tss1.m.should.equal(m);
      tss1.n.should.equal(n);
      tss1.partyId.should.equal(1);

      // party 2
      tss2 = new TssKeyGen({
        chain,
        network,
        baseUrl: '/bws/api',
        request: request(app),
        key: party2Key
      });
      result = await tss2.joinKey({ code: joinCode2 });
      should.exist(result);
      result.should.equal(tss2);
      tss2.id.should.equal(tss0.id);
      tss2.m.should.equal(m);
      tss2.n.should.equal(n);
      tss2.partyId.should.equal(2);
    });

    it(happyPath('should start round 1 by party1'), async function() {
      const e0 = tss0.exportSession();
      const e1 = tss1.exportSession();
      const e2 = tss2.exportSession();
      const sesh = await storage.fetchTssKeyGenSession({ id: tss0.id });

      // I chose to start the round with party 1. In practice, anyone can start the round
      const response = new Promise(r => tss1.once('roundsubmitted', r));
      tss1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss1.subscribe({ timeout: 10, iterHandler: () => tss1.unsubscribe() });
      const submittedRound = await response;
      submittedRound.should.equal(1);
    });

    it('should not allow party1 to go on to the next round', function(done) {
      const doReqSpy = sandbox.spy(Request.prototype, 'doRequest');
      tss1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss1.subscribe({ timeout: 10, iterHandler: () => {
        tss1.unsubscribe();
        doReqSpy.callCount.should.equal(1);
        doReqSpy.args[0][0].should.equal('get');
        doReqSpy.args[0][1].should.include(`/v1/tss/keygen/${tss1.id}/1?r=`);
        done();
      } });
    });

    it(happyPath('should continue round 1'), async function() {
      const response0 = new Promise(r => tss0.once('roundsubmitted', r));
      const response2 = new Promise(r => tss2.once('roundsubmitted', r));
      tss0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss2.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss0.subscribe({ timeout: 10, iterHandler: () => tss0.unsubscribe() });
      tss2.subscribe({ timeout: 10, iterHandler: () => tss2.unsubscribe() });
      const submitted0Round = await response0;
      const submitted2Round = await response2;
      submitted0Round.should.equal(1);
      submitted2Round.should.equal(1);
    });

    it('should export and restore the session', async function() {
      const s0 = tss0.exportSession();
      const s1 = tss1.exportSession();
      const s2 = tss2.exportSession();
      should.exist(s0);
      should.exist(s1);
      should.exist(s2);
      s0.should.be.a('string');
      s1.should.be.a('string');
      s2.should.be.a('string');

      tss0 = await new TssKeyGen({
        chain,
        network,
        baseUrl: '/bws/api',
        request: request(app),
        key: party0Key
      }).restoreSession({ session: s0 });

      tss1 = await new TssKeyGen({
        chain,
        network,
        baseUrl: '/bws/api',
        request: request(app),
        key: party1Key
      }).restoreSession({ session: s1 });
      
      tss2 = await new TssKeyGen({
        chain,
        network,
        baseUrl: '/bws/api',
        request: request(app),
        key: party2Key
      }).restoreSession({ session: s2 });
    });

    it(happyPath('should do round 2 (with API fault tolerance)'), async function() {
      // fault tolerance setup
      const postStub = sandbox.stub(Request.prototype, 'post').throws(new Error('restore me'));
      const t0RestoreSessionSpy = sandbox.spy(tss0, 'restoreSession');
      const t1RestoreSessionSpy = sandbox.spy(tss1, 'restoreSession');
      const t2RestoreSessionSpy = sandbox.spy(tss2, 'restoreSession');
      function restore() { postStub.restore?.(); };

      const response0 = new Promise(r => tss0.once('roundsubmitted', r));
      const response1 = new Promise(r => tss1.once('roundsubmitted', r));
      const response2 = new Promise(r => tss2.once('roundsubmitted', r));
      tss0.on('error', (e) => { e.message === 'restore me' ? restore() : should.not.exist(e?.message ?? e); });
      tss1.on('error', (e) => { e.message === 'restore me' ? restore() : should.not.exist(e?.message ?? e); });
      tss2.on('error', (e) => { e.message === 'restore me' ? restore() : should.not.exist(e?.message ?? e); });
      tss0.subscribe({ timeout: 10, iterHandler: () => tss0.unsubscribe() });
      tss1.subscribe({ timeout: 10, iterHandler: () => tss1.unsubscribe() });
      tss2.subscribe({ timeout: 10, iterHandler: () => tss2.unsubscribe() });
      const submitted0Round = await response0;
      submitted0Round.should.equal(2);
      const submitted1Round = await response1;
      submitted1Round.should.equal(2);
      const submitted2Round = await response2;
      submitted2Round.should.equal(2);
      // check that the fault tolerance worked
      (t0RestoreSessionSpy.callCount + t1RestoreSessionSpy.callCount + t2RestoreSessionSpy.callCount).should.be.gte(1);
    });

    it(happyPath('should do round 3'), async function() {
      const response0 = new Promise(r => tss0.once('roundsubmitted', r));
      const response1 = new Promise(r => tss1.once('roundsubmitted', r));
      const response2 = new Promise(r => tss2.once('roundsubmitted', r));
      tss0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss2.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss0.subscribe({ timeout: 10, iterHandler: () => tss0.unsubscribe() });
      tss1.subscribe({ timeout: 10, iterHandler: () => tss1.unsubscribe() });
      tss2.subscribe({ timeout: 10, iterHandler: () => tss2.unsubscribe() });
      const submitted0Round = await response0;
      submitted0Round.should.equal(3);
      const submitted1Round = await response1;
      submitted1Round.should.equal(3);
      const submitted2Round = await response2;
      submitted2Round.should.equal(3);
    });

    it(happyPath('should do round 4'), async function() {
      // round 4 does not emit a roundsubmitted event b/c the keychain is ready
      const response0 = new Promise(r => tss0.once('roundprocessed', r));
      const response1 = new Promise(r => tss1.once('roundprocessed', r));
      const response2 = new Promise(r => tss2.once('roundprocessed', r));
      const complete = new Promise(r => tss0.once('complete', r));
      tss0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss2.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss0.subscribe({ timeout: 10, iterHandler: () => tss0.unsubscribe() });
      tss1.subscribe({ timeout: 10, iterHandler: () => tss1.unsubscribe() });
      tss2.subscribe({ timeout: 10, iterHandler: () => tss2.unsubscribe() });
      const processed0Round = await response0;
      processed0Round.should.equal(4);
      const processed1Round = await response1;
      processed1Round.should.equal(4);
      const processed2Round = await response2;
      processed2Round.should.equal(4);
      // ensure that the rounds are completed so-as to prevent a race condition with the following test(s)
      await complete;
    });

    it(happyPath('should have stored the shared pub key'), async function() {
      const session = await storage.fetchTssKeyGenSession({ id: tss0.id });
      should.exist(session.sharedPublicKey);

      const key = tss0.getTssKey();
      should.exist(key);
      key.keychain.commonKeyChain.should.equal(session.sharedPublicKey);
    });

    it(happyPath('should have not stored the encrypted key shares'), async function() {
      const session = await storage.fetchTssKeyGenSession({ id: tss0.id });
      session.keyShares.length.should.equal(n);
      session.keyShares.every(share => share == null).should.equal(true); // encrypted keyshares are not stored
      return;

      // If we every decide to store the encrypted key shares...
      const key0 = tss0.getTssKey();
      const hdKey0 = new BitcoreLib.HDPrivateKey(party0Key.get().xPrivKey).deriveChild(derivationPath);
      const expected0 = key0.keychain.privateKeyShare.toString('base64') + ':' + key0.keychain.reducedPrivateKeyShare.toString('base64');
      ECIES.decrypt({
        payload: Buffer.from(session.keyShares[0], 'base64'),
        privateKey: hdKey0.privateKey,
        publicKey: hdKey0.publicKey
      }).toString().should.equal(expected0);
      const key1 = tss1.getTssKey();
      const hdKey1 = new BitcoreLib.HDPrivateKey(party1Key.get().xPrivKey).deriveChild(derivationPath);
      const expected1 = key1.keychain.privateKeyShare.toString('base64') + ':' + key1.keychain.reducedPrivateKeyShare.toString('base64');
      ECIES.decrypt({
        payload: Buffer.from(session.keyShares[1], 'base64'),
        privateKey: hdKey1.privateKey,
        publicKey: hdKey1.publicKey
      }).toString().should.equal(expected1);
      const key2 = tss2.getTssKey();
      const hdKey2 = new BitcoreLib.HDPrivateKey(party2Key.get().xPrivKey).deriveChild(derivationPath);
      const expected2 = key2.keychain.privateKeyShare.toString('base64') + ':' + key2.keychain.reducedPrivateKeyShare.toString('base64');
      ECIES.decrypt({
        payload: Buffer.from(session.keyShares[2], 'base64'),
        privateKey: hdKey2.privateKey,
        publicKey: hdKey2.publicKey
      }).toString().should.equal(expected2);
    });

    it('should not export a completed session', function() {
      should.throw(() => { tss0.exportSession(); }, /Cannot export a completed session/);
    });

    it('should cleanly handle a subscription to a finished session', async function() {
      const tss0EmitSpy = sandbox.spy(tss0, 'emit');
      const complete = new Promise(r => tss0.once('complete', r));
      tss0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss0.subscribe({ timeout: 10, iterHandler: () => tss0.unsubscribe() });
      await complete;
      tss0EmitSpy.args.filter(o => o[0] === 'roundready').length.should.equal(0);
      tss0EmitSpy.args.filter(o => o[0] === 'tsskey').length.should.equal(1);
      tss0EmitSpy.args.filter(o => o[0] === 'complete').length.should.equal(1);
    });

    // Keeping for documentation purposes
    it.skip('SKIP ME - save to data dir', function() { 
      fs.writeFileSync(`${datadir}/tss-party0.json`, JSON.stringify({ key: party0Key.toObj(), tss: tss0.getTssKey().toObj() }, null, 2));
      fs.writeFileSync(`${datadir}/tss-party1.json`, JSON.stringify({ key: party1Key.toObj(), tss: tss1.getTssKey().toObj() }, null, 2));
      fs.writeFileSync(`${datadir}/tss-party2.json`, JSON.stringify({ key: party2Key.toObj(), tss: tss2.getTssKey().toObj() }, null, 2));
    });

    describe('With Password', function() {
      const password = 'super|secret:password';

      async function setupSession(password) {
        const party0Key = new Key({ seedType: 'new' });
        const party1Key = new Key({ seedType: 'new' });
        const party2Key = new Key({ seedType: 'new' });
        const tss0 = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party0Key
        });
        const tss1 = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party1Key
        });
        const tss2 = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party2Key
        });
        await tss0.newKey({ m, n, password });
        return { tss0, tss1, tss2, party0Key, party1Key, party2Key };
      };

      it(happyPath('should start a new keygen session with a password'), async function() {
        const party0Key = new Key({ seedType: 'new' });
        const tss0 = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party0Key
        });
        const result = await tss0.newKey({ m, n, password });
        should.exist(result);
        result.should.equal(tss0);
        tss0.id.should.be.a('string');
        const chainXpriv = BitcoreLib.HDPrivateKey.fromString(party0Key.get().xPrivKey).deriveChild(derivationPath);
        const seed = crypto.createHash('sha256').update(chainXpriv.toBuffer()).digest();
        tss0.id.should.equal(crypto.createHash('sha256').update(crypto.createHash('sha256').update(seed).digest()).digest('hex'));
        tss0.m.should.equal(m);
        tss0.n.should.equal(n);
        tss0.partyId.should.equal(0);
        const session = await storage.fetchTssKeyGenSession({ id: tss0.id });
        should.exist(session.joinPassword);
      });

      it(happyPath('should join key with a password'), async function() {
        const { tss0, tss1, tss2, ...keys } = await setupSession(password);
        const code1 = await tss0.createJoinCode({
          partyId: 1,
          partyPubKey: keys.party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
        });
        should.exist(code1);
        await tss1.joinKey({ code: code1, password });
        const session = await storage.fetchTssKeyGenSession({ id: tss1.id });
        session.participants.should.deep.equal([
          keys.party0Key.createCredentials(null, { chain, network, n: 1, account: 0 }).copayerId,
          keys.party1Key.createCredentials(null, { chain, network, n: 1, account: 0 }).copayerId,
          null
        ]);
      });

      it(happyPath('should join key with a password embedded in the join code'), async function() {
        const { tss0, tss1, tss2, ...keys } = await setupSession(password);
        const code1 = await tss0.createJoinCode({
          partyId: 1,
          partyPubKey: keys.party1Key.createCredentials(null, { chain, network, n: 1, account: 0 }).requestPubKey,
          extra: password
        });
        should.exist(code1);
        await tss1.joinKey({ code: code1 });
        const session = await storage.fetchTssKeyGenSession({ id: tss1.id });
        session.participants.should.deep.equal([
          keys.party0Key.createCredentials(null, { chain, network, n: 1, account: 0 }).copayerId,
          keys.party1Key.createCredentials(null, { chain, network, n: 1, account: 0 }).copayerId,
          null
        ]);
      });

      it('should NOT join key with a WRONG password', async function() {
        const { tss0, tss1, tss2, ...keys } = await setupSession(password);
        const code1 = await tss0.createJoinCode({
          partyId: 1,
          partyPubKey: keys.party1Key.createCredentials(null, { chain, network, n: 1, account: 0 }).requestPubKey
        });
        should.exist(code1);
        try {
          await tss1.joinKey({ code: code1, password: 'wrongpassword' });
          throw new Error('should have thrown');
        } catch (err) {
          err.message.should.include('TSS_INVALID_PASSWORD');
        }
        const session = await storage.fetchTssKeyGenSession({ id: tss1.id });
        session.participants.should.deep.equal([
          keys.party0Key.createCredentials(null, { chain, network, n: 1, account: 0 }).copayerId,
          null, // not joined
          null
        ]);
      });

      it('should NOT join key with a MISSING password', async function() {
        const { tss0, tss1, tss2, ...keys } = await setupSession(password);
        const code1 = await tss0.createJoinCode({
          partyId: 1,
          partyPubKey: keys.party1Key.createCredentials(null, { chain, network, n: 1, account: 0 }).requestPubKey
        });
        should.exist(code1);
        try {
          await tss1.joinKey({ code: code1 });
          throw new Error('should have thrown');
        } catch (err) {
          err.message.should.include('TSS_INVALID_PASSWORD');
        }
        const session = await storage.fetchTssKeyGenSession({ id: tss1.id });
        session.participants.should.deep.equal([
          keys.party0Key.createCredentials(null, { chain, network, n: 1, account: 0 }).copayerId,
          null, // not joined
          null
        ]);
      });
    });

    describe('Out of partyId order', function() {
      let tss0: TssKeyGen;
      let tss1: TssKeyGen;
      let tss2: TssKeyGen;

      afterEach(function() {
        tss0?.unsubscribe();
        tss1?.unsubscribe();
        tss2?.unsubscribe();
      });

      it(happyPath('should generate the key when parties join out of partyId order'), async function() {
        const party0Key = new Key({ seedType: 'new' });
        const party1Key = new Key({ seedType: 'new' });
        const party2Key = new Key({ seedType: 'new' });
        tss0 = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party0Key
        });
        tss1 = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party1Key
        });
        tss2 = new TssKeyGen({
          chain,
          network,
          baseUrl: '/bws/api',
          request: request(app),
          key: party2Key
        });
        await tss0.newKey({ m, n });
        const code1 = await tss0.createJoinCode({
          partyId: 1,
          partyPubKey: party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
        });
        const code2 = await tss0.createJoinCode({
          partyId: 2,
          partyPubKey: party2Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
        });

        await tss2.joinKey({ code: code2 });
        await tss1.joinKey({ code: code1 });
        let session = await storage.fetchTssKeyGenSession({ id: tss0.id });
        session.rounds[0].map(message => message.fromPartyId).should.deep.equal([0, 2, 1]);

        const complete0 = new Promise(r => tss0.once('complete', r));
        const complete1 = new Promise(r => tss1.once('complete', r));
        const complete2 = new Promise(r => tss2.once('complete', r));
        tss0.on('error', (e) => { should.not.exist(e?.message ?? e); });
        tss1.on('error', (e) => { should.not.exist(e?.message ?? e); });
        tss2.on('error', (e) => { should.not.exist(e?.message ?? e); });
        tss0.subscribe({ timeout: 10 });
        tss1.subscribe({ timeout: 10 });
        tss2.subscribe({ timeout: 10 });
        await Promise.all([complete0, complete1, complete2]);

        session = await storage.fetchTssKeyGenSession({ id: tss0.id });
        tss0.getTssKey().keychain.commonKeyChain.should.equal(session.sharedPublicKey);
        tss1.getTssKey().keychain.commonKeyChain.should.equal(session.sharedPublicKey);
        tss2.getTssKey().keychain.commonKeyChain.should.equal(session.sharedPublicKey);
      });
    });
  });


  describe('Wallet join delivery', function() {
    const WALLET_ID = '7f0e1a2b-3c4d-4e5f-8a9b-0c1d2e3f4a5b';
    const walletPrivKey = new BitcoreLib.PrivateKey();
    const secret = Client._buildSecret(WALLET_ID, walletPrivKey, chain.toLowerCase(), network);
    let keys: Array<InstanceType<typeof Key>>;
    const credsOf = (key: InstanceType<typeof Key>) => key.createCredentials(null, { chain: chain.toLowerCase(), network, n: 1, account: 0 });
    const newTss = (key: InstanceType<typeof Key>) => new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
    let createWalletStub: sinon.SinonStub;
    let joinWalletStub: sinon.SinonStub;
    let tssKeyGens: TssKeyGen[];
    const rejects = async (promise: Promise<any>, msg: RegExp) => {
      const err = await promise.then(() => null, e => e ?? new Error('rejected with nothing'));
      should.exist(err, 'expected a rejection');
      (err.name + ' ' + err.message).should.match(msg);
      return err;
    };

    beforeEach(function() {
      // The session id derives from the key, so every test needs its own keys
      keys = [0, 1, 2].map(() => new Key({ seedType: 'new' }));
      tssKeyGens = [];
      // Wallet creation/joining at BWS is the ordinary, unchanged flow; stub it to observe what is handed to it
      createWalletStub = sandbox.stub(Client.prototype, 'createWallet').resolves({ wallet: { addressType: 'P2PKH' }, secret } as any);
      joinWalletStub = sandbox.stub(Client.prototype, 'joinWallet').resolves({ addressType: 'P2PKH' } as any);
    });

    afterEach(function() {
      for (const t of tssKeyGens) t.unsubscribe();
    });

    async function invite(tss0: TssKeyGen, joiners: TssKeyGen[]) {
      await tss0.newKey({ m, n: joiners.length + 1 });
      for (let i = 0; i < joiners.length; i++) {
        const code = await tss0.createJoinCode({ partyId: i + 1, partyPubKey: credsOf(keys[i + 1]).requestPubKey });
        await joiners[i].joinKey({ code });
      }
    }

    function complete(list: TssKeyGen[], subscribeOpts: (i: number) => any = () => ({})) {
      const done = list.map(t => new Promise(r => t.once('complete', r)));
      for (const [i, t] of list.entries()) t.subscribe({ timeout: 10, ...subscribeOpts(i) });
      return Promise.all(done);
    }

    async function dkgOnly() {
      const [tss0, tss1, tss2] = tssKeyGens = keys.map(newTss);
      await invite(tss0, [tss1, tss2]);
      await complete(tssKeyGens);
      return tssKeyGens;
    }

    async function storedRecords(id: string) {
      return (await storage.fetchTssKeyGenSession({ id })).bwsJoinSecrets;
    }

    async function overwriteRecords(id: string, mutate: (records: any[]) => any[]) {
      const doc = await storage.db.collection('tss_keygen').findOne({ id });
      await storage.db.collection('tss_keygen').updateOne({ id }, { $set: { bwsJoinSecrets: mutate(doc.bwsJoinSecrets) } });
    }

    function rawRequest(key: InstanceType<typeof Key>) {
      const r = new Request('/bws/api', { r: request(app) });
      r.setCredentials(credsOf(key));
      return r;
    }

    it(happyPath('should complete when publication is unavailable until recipients have polled, then lost once'), async function() {
      const [tss0, tss1, tss2] = tssKeyGens = keys.map(newTss);
      await invite(tss0, [tss1, tss2]);

      // Hold publication until both recipients have finished DKG and been told there is nothing to retrieve yet
      const posted: any[] = [];
      let release: () => void;
      const gate = new Promise<void>(r => { release = r; });
      const store = BwsTssKeyGen.storeBwsJoinSecret;
      let attempts = 0;
      sandbox.stub(BwsTssKeyGen, 'storeBwsJoinSecret').callsFake(async function(params) {
        posted.push(params.records);
        await gate;
        await store.call(BwsTssKeyGen, params);
        if (attempts++ === 0) {
          throw new Error('response lost'); // stored, but the creator never hears about it
        }
      });
      const pending = new Set<string>();
      let recipientsPolled: () => void;
      const polled = new Promise<void>(r => { recipientsPolled = r; });
      const get = BwsTssKeyGen.getBwsJoinSecret;
      sandbox.stub(BwsTssKeyGen, 'getBwsJoinSecret').callsFake(async function(params) {
        try {
          return await get.call(BwsTssKeyGen, params);
        } catch (err) {
          if (/join secret not found/.test(err?.message)) {
            pending.add(params.copayerId);
            if (pending.size === 2) recipientsPolled();
          }
          throw err;
        }
      });
      const errors: any[] = [];
      const finished = new Set<number>();
      for (const [i, t] of tssKeyGens.entries()) {
        t.on('error', e => errors.push(e));
        t.once('complete', () => finished.add(i));
      }
      const allComplete = complete(tssKeyGens, i => i === 0 ? { walletName: 'w', copayerName: 'c0' } : { copayerName: 'c' + i });
      try {
        await polled;
        // Recipients have a finished DKG, asked for the delivery and got nothing; nobody is done yet
        tss1.getTssKey().should.not.equal(null);
        tss2.getTssKey().should.not.equal(null);
        [...finished].should.deep.equal([]);
        joinWalletStub.callCount.should.equal(0);
      } finally {
        release();
      }
      await allComplete;

      createWalletStub.callCount.should.equal(1);
      joinWalletStub.callCount.should.equal(2);
      for (const a of joinWalletStub.args) a[0].should.equal(secret);
      attempts.should.be.greaterThan(1);
      // The completed DKG is never re-exported or re-processed while waiting
      for (const e of errors) e.message.should.not.include('Cannot export a completed session');

      const captured = JSON.stringify(posted) + JSON.stringify(await storedRecords(tss0.id));
      captured.should.not.include(secret);
      captured.should.not.include(walletPrivKey.toString());
      captured.should.not.include(walletPrivKey.toWIF());
      const doc = await storage.db.collection('tss_keygen').findOne({ id: tss0.id });
      should.not.exist(doc.bwsJoinSecret);
      (await storedRecords(tss0.id)).map(r => r.partyId).should.deep.equal([1, 2]);
    });

    describe('ordinary wallet enrollment (not stubbed)', function() {
      const derivationPath = 'm/0/0';

      beforeEach(function() {
        createWalletStub.restore();
        joinWalletStub.restore();
        // TssKeyGen builds its own API client; point it at the in-process BWS
        const fromObj = Client.prototype.fromObj;
        sandbox.stub(Client.prototype, 'fromObj').callsFake(function(this: any, ...args: any[]) {
          const result = fromObj.apply(this, args);
          this.request.r = request(app);
          return result;
        });
        sandbox.spy(Client.prototype, 'createWallet');
        sandbox.spy(Client.prototype, 'joinWallet');
      });

      for (const parties of [2, 3]) {
        it(happyPath(`should enroll every party of a 2-of-${parties} key in one wallet, recover it, and sign`), async function() {
          const list = tssKeyGens = keys.slice(0, parties).map(newTss);
          await invite(list[0], list.slice(1));
          const errors: any[] = [];
          for (const t of list) t.on('error', e => errors.push(e));
          const walletName = `enroll-${parties}`;
          await complete(list, i => i === 0 ? { walletName, copayerName: 'c0' } : { copayerName: 'c' + i });
          errors.should.deep.equal([]);

          (Client.prototype.createWallet as sinon.SinonSpy).callCount.should.equal(1);
          (Client.prototype.joinWallet as sinon.SinonSpy).callCount.should.equal(parties - 1);
          const created = await (Client.prototype.createWallet as sinon.SinonSpy).returnValues[0];

          const session = await storage.fetchTssKeyGenSession({ id: list[0].id });
          const wallets = await storage.db.collection('wallets').find({ tssKeyId: list[0].id }).toArray();
          wallets.length.should.equal(1);
          wallets[0].copayers.map(c => c.id).sort().should.deep.equal([...session.participants].sort());

          // Reopen the saved wallet from each party's key: encrypted metadata must be readable and copayers verified
          const clients = [];
          for (const [i, t] of list.entries()) {
            const creds = t.getTssKey().createCredentials(null, {
              chain: chain.toLowerCase(),
              coin: chain.toLowerCase(),
              network,
              account: 0
            });
            should.not.exist(creds.walletPrivKey);
            const client = helpers.newClient(app);
            client.fromObj(creds);
            await client.openWallet();
            // Recovered from the party's personally encrypted customData, not supplied by the test
            client.credentials.walletPrivKey.should.equal(Client.parseSecret(created.secret).walletPrivKey.toString());
            client.credentials.walletId.should.equal(created.wallet.id);
            client.credentials.walletName.should.equal(walletName);
            client.credentials.copayerName.should.equal('c' + i);
            clients.push(client);
          }
          const status = await clients[1].getStatus({});
          status.wallet.copayers.map(c => c.name).sort().should.deep.equal(list.map((_, i) => 'c' + i).sort());

          // Normal threshold signature by the enrolled parties
          const messageHash = BitcoreLib.crypto.Hash.sha256(Buffer.from('enrollment ' + walletName)); // the sign session id derives from it
          const sigs = [0, 1].map(i => new TssSign({
            baseUrl: '/bws/api',
            request: request(app),
            credentials: clients[i].credentials,
            tssKey: list[i].getTssKey()
          }));
          for (const sig of sigs) await sig.start({ messageHash, derivationPath });
          const signed = sigs.map(sig => new Promise(r => sig.once('complete', r)));
          for (const sig of sigs) {
            sig.on('error', (e) => { should.not.exist(e?.message ?? e); });
            sig.subscribe({ timeout: 10 });
          }
          await Promise.all(signed);
          const signature = sigs[0].getSignature();
          const pubKey = BitcoreLib.HDPublicKey(list[0].getTssKey().getXPubKey(network)).deriveChild(derivationPath).publicKey.toString('hex');
          signature.pubKey.should.equal(pubKey);
        });
      }
    });

    it('should serve only the caller\'s record, repeatedly, and enforce the existing access boundary', async function() {
      const [tss0] = await dkgOnly();
      const get = (key) => rawRequest(key).get(`/v1/tss/keygen/${tss0.id}/secret`);

      // not yet published
      await rejects(get(keys[1]), /BWS join secret not found|TSS_BWS_JOIN_SECRET_NOT_FOUND/);

      // creator only
      const body = { records: [1, 2].map(partyId => ({ partyId, encryptedMessage: 'AAAA', signature: 'sig' })) };
      await rejects(rawRequest(keys[1]).post(`/v1/tss/keygen/${tss0.id}/secret`, body), /Only the session creator can store the BWS join secret/);
      await rejects(rawRequest(keys[0]).post(`/v1/tss/keygen/${tss0.id}/secret`, { secret: secret }), /Invalid BWS join delivery provided/); // legacy plaintext
      should.not.exist(await storedRecords(tss0.id));

      // malformed sets
      const record = (partyId, extra = {}) => ({ partyId, encryptedMessage: 'AAAA', signature: 'sig', ...extra });
      const bad = [
        { records: [record(1)] },
        { records: [record(1), record(1)] },
        { records: [record(0), record(1)] },
        { records: [record(1), record(3)] },
        { records: [record(1), record(2, { signature: 'x'.repeat(257) })] },
        { records: [record(1), record(2, { encryptedMessage: 'x'.repeat(16 * 1024 + 1) })] },
        { records: [record(1), record(2, { encryptedMessage: '' })] }
      ];
      for (const b of bad) {
        await rejects(rawRequest(keys[0]).post(`/v1/tss/keygen/${tss0.id}/secret`, b), /Invalid BWS join delivery provided/);
      }
      should.not.exist(await storedRecords(tss0.id));

      await rawRequest(keys[0]).post(`/v1/tss/keygen/${tss0.id}/secret`, { ...body, records: body.records.map(r => ({ ...r, encryptedMessage: 'ENC' + r.partyId })) });
      for (let i = 0; i < 2; i++) { // repeat GET works
        for (const p of [1, 2]) {
          const { body: res } = await get(keys[p]);
          res.should.deep.equal({ encryptedMessage: 'ENC' + p, signature: 'sig' });
        }
      }
      // nonparticipant
      await rejects(get(new Key({ seedType: 'new' })), /NOT_AUTHORIZED/);
      // missing session
      await rejects(rawRequest(keys[1]).get('/v1/tss/keygen/nonexistent/secret'), /Session not found/);
    });

    it('should never return a legacy plaintext secret', async function() {
      const [tss0] = await dkgOnly();
      await storage.db.collection('tss_keygen').updateOne({ id: tss0.id }, { $set: { bwsJoinSecret: secret } });
      await rejects(rawRequest(keys[1]).get(`/v1/tss/keygen/${tss0.id}/secret`), /BWS join secret not found|TSS_BWS_JOIN_SECRET_NOT_FOUND/);
    });

    describe('verification of the delivery', function() {
      let tss0: TssKeyGen;
      let tss1: TssKeyGen;
      let tss2: TssKeyGen;

      beforeEach(async function() {
        [tss0, tss1, tss2] = await dkgOnly();
        await tss0.createWallet({ walletName: 'w', copayerName: 'c0' });
        createWalletStub.callCount.should.equal(1);
      });

      const rejected = async (tss: TssKeyGen, msg: RegExp) => {
        await rejects(tss.joinWallet({ copayerName: 'c' }), msg);
        joinWalletStub.callCount.should.equal(0);
      };

      it(happyPath('should join with a valid delivery'), async function() {
        await tss1.joinWallet({ copayerName: 'c1' });
        await tss2.joinWallet({ copayerName: 'c2' });
        joinWalletStub.args.map(a => a[0]).should.deep.equal([secret, secret]);
      });

      it('should reject a plaintext response instead of falling back to legacy enrollment', async function() {
        sandbox.stub(BwsTssKeyGen, 'getBwsJoinSecret').resolves({ secret });
        await rejected(tss1, /Unsupported wallet join delivery/);
      });

      it(happyPath('should reuse the created wallet when publication is retried'), async function() {
        await tss0.createWallet({ walletName: 'w', copayerName: 'c0' });
        createWalletStub.callCount.should.equal(1);
      });

      it('should reject a changed ciphertext or signature', async function() {
        await overwriteRecords(tss0.id, recs => recs.map(r => r.partyId === 1 ? { ...r, encryptedMessage: Buffer.from(r.encryptedMessage, 'base64').fill(1, 40, 45).toString('base64') } : r));
        await rejected(tss1, /decrypt and verify/);
        await overwriteRecords(tss0.id, recs => recs.map(r => ({ ...r, signature: recs.find(o => o.partyId !== r.partyId).signature })));
        await rejected(tss2, /decrypt and verify/);
      });

      it('should reject a record that was not encrypted to the recipient', async function() {
        await overwriteRecords(tss0.id, recs => recs.map(r => ({ ...r, partyId: 3 - r.partyId })));
        await rejected(tss1, /decrypt and verify/);
      });

      it('should reject a delivery from a key other than the invitation key', async function() {
        const impostor = new BitcoreLib.PrivateKey();
        const payload = Buffer.from(JSON.stringify({ purpose: 'tss-wallet-join-v1', sessionId: tss0.id, partyId: 1, commonKeyChain: tss1.getTssKey().keychain.commonKeyChain, secret }));
        const forged = TssUtils.encryptAndDetachSignData(payload, credsOf(keys[1]).requestPubKey, impostor);
        await overwriteRecords(tss0.id, recs => recs.map(r => r.partyId === 1 ? { partyId: 1, ...forged } : r));
        await rejected(tss1, /decrypt and verify/);
      });

      it('should reject a delivery for a different session, party, keychain, chain or network', async function() {
        const creator = new BitcoreLib.PrivateKey(credsOf(keys[0]).requestPrivKey);
        const base = { purpose: 'tss-wallet-join-v1', sessionId: tss0.id, partyId: 1, commonKeyChain: tss1.getTssKey().keychain.commonKeyChain, secret };
        const otherChain = Client._buildSecret(WALLET_ID, walletPrivKey, 'btc', network);
        const otherNetwork = Client._buildSecret(WALLET_ID, walletPrivKey, chain.toLowerCase(), 'testnet');
        const variants = [
          { changes: { sessionId: 'other' }, error: /Wallet join delivery does not match this key generation session/ },
          { changes: { partyId: 2 }, error: /Wallet join delivery does not match this key generation session/ },
          { changes: { commonKeyChain: tss1.getTssKey().keychain.commonKeyChain.replace(/.$/, c => c === 'a' ? 'b' : 'a') }, error: /Wallet join delivery does not match this key generation session/ },
          { changes: { purpose: 'something-else' }, error: /Wallet join delivery does not match this key generation session/ },
          { changes: { secret: otherChain }, error: /Wallet join delivery is for a different chain or network/ },
          { changes: { secret: otherNetwork }, error: /Wallet join delivery is for a different chain or network/ },
          { changes: { secret: 'not a secret' }, error: /Invalid secret/ }
        ];
        for (const { changes, error } of variants) {
          const forged = TssUtils.encryptAndDetachSignData(Buffer.from(JSON.stringify({ ...base, ...changes })), credsOf(keys[1]).requestPubKey, creator);
          await overwriteRecords(tss0.id, recs => recs.map(r => r.partyId === 1 ? { partyId: 1, ...forged } : r));
          await rejected(tss1, error);
        }
      });

      it('should not include the plaintext in errors', async function() {
        const creator = new BitcoreLib.PrivateKey(credsOf(keys[0]).requestPrivKey);
        const forged = TssUtils.encryptAndDetachSignData(Buffer.from(JSON.stringify({ purpose: 'x', secret })), credsOf(keys[1]).requestPubKey, creator);
        await overwriteRecords(tss0.id, recs => recs.map(r => r.partyId === 1 ? { partyId: 1, ...forged } : r));
        const err = await rejects(tss1.joinWallet({ copayerName: 'c' }), /Wallet join delivery does not match this key generation session/);
        err.message.should.not.include(secret);
      });
    });

    describe('session export and restore', function() {
      const decryptExport = (key, exported: string) => {
        const c = credsOf(key);
        return JSON.parse(TssUtils.decrypt(Buffer.from(exported.split('.').pop(), 'base64'), c.requestPubKey, c.requestPrivKey).toString());
      };

      it(happyPath('should restore the invitation keys of the creator and a recipient into fresh instances'), async function() {
        const [tss0, tss1, tss2] = tssKeyGens = keys.map(newTss);
        await invite(tss0, [tss1, tss2]);
        const e0 = tss0.exportSession();
        const e1 = tss1.exportSession();
        e0.should.not.include(keys[0].get().xPrivKey);
        Object.keys(decryptExport(keys[0], e0).recipientKeys).should.deep.equal(['1', '2']);
        decryptExport(keys[1], e1).creatorPubKey.should.equal(credsOf(keys[0]).requestPubKey);

        const fresh0 = newTss(keys[0]);
        const fresh1 = newTss(keys[1]);
        tssKeyGens = [fresh0, fresh1, tss2];
        await fresh0.restoreSession({ session: e0 });
        await fresh1.restoreSession({ session: e1 });
        await complete(tssKeyGens, i => i === 0 ? { walletName: 'w', copayerName: 'c0' } : { copayerName: 'c' + i });
        createWalletStub.callCount.should.equal(1);
        joinWalletStub.callCount.should.equal(2);
      });

      it(happyPath('should keep the bindings across a same-instance restore (round rollback)'), async function() {
        const [tss0, tss1, tss2] = tssKeyGens = keys.map(newTss);
        await invite(tss0, [tss1, tss2]);
        await tss0.restoreSession({ session: tss0.exportSession() });
        Object.keys(decryptExport(keys[0], tss0.exportSession()).recipientKeys).should.deep.equal(['1', '2']);
      });

      it('should restore the legacy export format within the same protocol for DKG only, with no delivery trust', async function() {
        const [tss0, tss1, tss2] = tssKeyGens = keys.map(newTss);
        await invite(tss0, [tss1, tss2]);
        const legacy0 = decryptExport(keys[0], tss0.exportSession()).session;
        const legacy1 = decryptExport(keys[1], tss1.exportSession()).session;
        const fresh0 = newTss(keys[0]);
        const fresh1 = newTss(keys[1]);
        tssKeyGens = [fresh0, fresh1, tss2];
        await fresh0.restoreSession({ session: legacy0 });
        await fresh1.restoreSession({ session: legacy1 });
        await complete(tssKeyGens);
        await rejects(fresh0.createWallet({ walletName: 'w', copayerName: 'c0' }), /Missing trusted invitation keys/);
        createWalletStub.callCount.should.equal(0);
        await rejects(fresh1.joinWallet({ copayerName: 'c1' }), /Missing the trusted invitation key/);
        joinWalletStub.callCount.should.equal(0);
        should.not.exist(await storedRecords(tss0.id));
      });

      it('should not replace bindings when the session export cannot be decrypted', async function() {
        const [tss0, tss1, tss2] = tssKeyGens = keys.map(newTss);
        await invite(tss0, [tss1, tss2]);
        const original = decryptExport(keys[0], tss0.exportSession());
        await rejects(tss0.restoreSession({ session: 'tsssession.v2.' + Buffer.from('garbage').toString('base64') }), /Invalid checksum/);
        decryptExport(keys[0], tss0.exportSession()).recipientKeys.should.deep.equal(original.recipientKeys);
      });

      it('should preserve the session and bindings when the inner DKG restore fails', async function() {
        const [tss0, tss1, tss2] = tssKeyGens = keys.map(newTss);
        await invite(tss0, [tss1, tss2]);

        for (const [i, tss] of [tss0, tss1].entries()) {
          const original = decryptExport(keys[i], tss.exportSession());
          const metadata = { id: tss.id, partyId: tss.partyId, m: tss.m, n: tss.n };
          const credentials = credsOf(keys[i]);
          // Keep the outer wrapper valid, but give the inner restore invalid DKG bytes
          // and different metadata/bindings that must not replace the active session.
          const wrapped = {
            session: ['other-session', 2, 1, 2, Buffer.from('garbage').toString('base64')].join(':'),
            recipientKeys: {},
            creatorPubKey: credsOf(keys[2]).requestPubKey
          };
          const encrypted = TssUtils.encrypt(Buffer.from(JSON.stringify(wrapped)), credentials.requestPubKey, credentials.requestPrivKey);
          await rejects(tss.restoreSession({ session: 'tsssession.v2.' + encrypted.toString('base64') }), /Invalid checksum/);

          ({ id: tss.id, partyId: tss.partyId, m: tss.m, n: tss.n }).should.deep.equal(metadata);
          const restored = decryptExport(keys[i], tss.exportSession());
          restored.recipientKeys.should.deep.equal(original.recipientKeys);
          should.equal(restored.creatorPubKey, original.creatorPubKey);
        }

        for (const tss of tssKeyGens) tss.on('error', (e) => { should.not.exist(e?.message ?? e); });
        await complete(tssKeyGens, i => i === 0 ? { walletName: 'w', copayerName: 'c0' } : { copayerName: 'c' + i });
        createWalletStub.callCount.should.equal(1);
        joinWalletStub.callCount.should.equal(2);
      });
    });
  });


  describe('Signing', function() {
    let sig0;
    let sig1;
    let export0;
    let export1;
    let party0Creds;
    let party1Creds;
    let party2Creds;
    let party0TssKey;
    let party1TssKey;
    let party2TssKey;
    const message = 'hello world';
    const messageHash = BitcoreLib.crypto.Hash.sha256(Buffer.from(message));
    const derivationPath = 'm/0/0';

    function objToBuf(key, value) {
      if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
        return Buffer.from(value.data);
      }
      return value;
    };

    before(async function() {
      ({ tss: party0TssKey } = JSON.parse(fs.readFileSync(`${datadir}/tss-party0.json`).toString(), objToBuf));
      ({ tss: party1TssKey } = JSON.parse(fs.readFileSync(`${datadir}/tss-party1.json`).toString(), objToBuf));
      ({ tss: party2TssKey } = JSON.parse(fs.readFileSync(`${datadir}/tss-party2.json`).toString(), objToBuf));
      party0TssKey = new TssKey(party0TssKey);
      party1TssKey = new TssKey(party1TssKey);
      party2TssKey = new TssKey(party2TssKey);
      party0Creds = party0TssKey.createCredentials(null, { chain, network: 'testnet', m, n, account: 0 });
      party1Creds = party1TssKey.createCredentials(null, { chain, network: 'testnet', m, n, account: 0 });
      party2Creds = party2TssKey.createCredentials(null, { chain, network: 'testnet', m, n, account: 0 });
      await storage.storeTssKeyGenSession({
        doc: {
          id: party0TssKey.metadata.id,
          participants: [
            party0Creds.copayerId,
            party1Creds.copayerId,
            party2Creds.copayerId
          ],
          sharedPublicKey: party0TssKey.keychain.commonKeyChain,
        }
      });
      const client = helpers.newClient(app);
      // for (const tssKey of [party0TssKey, party1TssKey, party2TssKey]) {
      await helpers.createAndJoinWallet(
        [client, client, client],
        [party0TssKey, party1TssKey, party2TssKey],
        m,
        n,
        {
          key: party0TssKey,
          coin: chain.toLowerCase(),
          tssKeyId: party0TssKey.metadata.id
        }
      );
      // }
    });

    it(happyPath('should start a new signing session'), async function() {
      sig1 = new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party1Creds,
        tssKey: party1TssKey,
      });
      const result = await sig1.start({ messageHash, derivationPath });
      should.exist(result);
      result.should.be.instanceOf(TssSign);
      result.should.equal(sig1);
      sig1.id.should.be.a('string');
      sig1.id.should.equal(BitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message)).toString('hex'));
    });

    it(happyPath('should join a signing session'), async function() {
      sig0 = new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party0Creds,
        tssKey: party0TssKey,
      });
      const result = await sig0.start({ messageHash, derivationPath });
      should.exist(result);
      result.should.be.instanceOf(TssSign);
      result.should.equal(sig0);
      sig0.id.should.equal(sig1.id);
    });

    it(happyPath('should emit copayerReady for self on start() and for remote on subscribe()'), async function() {
      const copayerReadyIds: string[] = [];
      const sigA = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: party0Creds, tssKey: party0TssKey });
      const sigB = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: party1Creds, tssKey: party1TssKey });
      sigA.on('copayerReady', (id) => copayerReadyIds.push(id));
      await sigA.start({ id: 'copayer-ready-test', messageHash, derivationPath });
      copayerReadyIds.should.deep.equal([party0Creds.copayerId]);
      await sigB.start({ id: 'copayer-ready-test', messageHash, derivationPath });
      sigA.on('error', (e) => { should.not.exist(e?.message ?? e); });
      const roundsubmitted = new Promise(r => sigA.once('roundsubmitted', r));
      sigA.subscribe({ timeout: 10, iterHandler: () => sigA.unsubscribe() });
      await roundsubmitted;
      copayerReadyIds.should.include(party0Creds.copayerId);
      copayerReadyIds.should.include(party1Creds.copayerId);
    });

    it('should reject too many participants', async function() {
      const sig2 = new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party2Creds,
        tssKey: party2TssKey,
      });
      try {
        await sig2.start({ messageHash, derivationPath });
        throw new Error('Should have thrown');
      } catch (err) {
        err.message.should.include('TSS_MAX_PARTICIPANTS_REACHED');
      }
    });

    it(happyPath('should do round 1'), async function() {
      const response0 = new Promise(r => sig0.once('roundsubmitted', r));
      const response1 = new Promise(r => sig1.once('roundsubmitted', r));
      sig0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
      sig1.subscribe({ timeout: 10, iterHandler: () => sig1.unsubscribe() });
      const submitted0Round = await response0;
      const submitted1Round = await response1;
      submitted0Round.should.equal(1);
      submitted1Round.should.equal(1);
    });

    it('should export and restore the session', async function() {
      // This test is between rounds 1 & 2 to help debug if the export/restore is working.
      // If round 1 test succeeds but 2 fails, the session restoration may be the reason.

      export0 = sig0.exportSession();
      export1 = sig1.exportSession();
      should.exist(export0);
      should.exist(export1);
      export0.should.be.a('string');
      export1.should.be.a('string');

      sig0 = await new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party0Creds,
        tssKey: party0TssKey,
      }).restoreSession({ session: export0 });

      sig1 = await new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party1Creds,
        tssKey: party1TssKey,
      }).restoreSession({ session: export1 });

      sig0.should.be.instanceOf(TssSign);
      sig1.should.be.instanceOf(TssSign);
    });

    it(happyPath('should do round 2'), async function() {
      const response0 = new Promise(r => sig0.once('roundsubmitted', r));
      const response1 = new Promise(r => sig1.once('roundsubmitted', r));
      sig0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
      sig1.subscribe({ timeout: 10, iterHandler: () => sig1.unsubscribe() });
      const submitted0Round = await response0;
      const submitted1Round = await response1;
      submitted0Round.should.equal(2);
      submitted1Round.should.equal(2);
    });

    it('should error for a duplicate round message', async function() {
      const sig0 = await new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party0Creds,
        tssKey: party0TssKey,
      }).restoreSession({ session: export0 });
      const emitSpy = sandbox.spy(sig0, 'emit');
      const error = new Promise<Error>(r => sig0.on('error', r));
      sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
      const e = await error;
      emitSpy.callCount.should.equal(4);
      emitSpy.args[0][0].should.equal('copayerReady');
      emitSpy.args[1][0].should.equal('roundready');
      emitSpy.args[2][0].should.equal('roundprocessed');
      emitSpy.args[3][0].should.equal('error');
      emitSpy.args[3][1].should.equal(e);
      e.message.should.include('TSS_ROUND_ALREADY_DONE');
    });

    it('should roll back an encrypted signing session without masking the original error', async function() {
      const password = 'encrypted-tss-password';
      party0TssKey.encrypt(password, { iter: 1 });

      try {
        should.not.exist(party0TssKey.keychain.privateKeyShare);

        const encryptedSig = await new TssSign({
          baseUrl: '/bws/api',
          request: request(app),
          credentials: party0Creds,
          tssKey: party0TssKey,
        }).restoreSession({ session: export0, password });

        const error = new Promise<Error>(r => encryptedSig.once('error', r));
        encryptedSig.subscribe({ timeout: 10 });
        const e = await error;
        encryptedSig.unsubscribe();

        e.message.should.include('TSS_ROUND_ALREADY_DONE');
        e.message.should.not.include('password is required');

        const retryError = new Promise<Error>(r => encryptedSig.once('error', r));
        encryptedSig.subscribe({ timeout: 10 });
        const retry = await retryError;
        encryptedSig.unsubscribe();

        retry.message.should.include('TSS_ROUND_ALREADY_DONE');
        retry.message.should.not.include('password is required');
      } finally {
        party0TssKey.decrypt(password);
      }
    });

    it(happyPath('should do round 3'), async function() {
      const response0 = new Promise(r => sig0.once('roundsubmitted', r));
      const response1 = new Promise(r => sig1.once('roundsubmitted', r));
      sig0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
      sig1.subscribe({ timeout: 10, iterHandler: () => sig1.unsubscribe() });
      const submitted0Round = await response0;
      const submitted1Round = await response1;
      submitted0Round.should.equal(3);
      submitted1Round.should.equal(3);
    });

    it(happyPath('should do round 4'), async function() {
      // round 4 does not emit a roundsubmitted event b/c the signature is ready
      const response0 = new Promise(r => sig0.once('roundprocessed', r));
      const response1 = new Promise(r => sig1.once('roundprocessed', r));
      const signature = new Promise(r => sig1.once('signature', r));
      const complete = new Promise(r => sig0.once('complete', r));
      sig0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
      sig1.subscribe({ timeout: 10, iterHandler: () => sig1.unsubscribe() });
      const processed0Round = await response0;
      const processed1Round = await response1;
      processed0Round.should.equal(4);
      processed1Round.should.equal(4);
      // ensure that the rounds are completed so-as to prevent
      await complete;
      const sig = await signature;
      should.exist(sig);
    });

    it(happyPath('should have the signature'), async function() {
      const sig = sig0.getSignature();
      should.exist(sig);
      sig.r.should.be.a('string');
      sig.s.should.be.a('string');
      sig.v.should.be.a('number');
      sig.pubKey.should.be.a('string');
    });

    it(happyPath('should have stored the signature'), async function() {
      const session = await storage.fetchTssSigSession({ id: sig0.id });
      const sig = sig0.getSignature();
      should.exist(session.signature);
      session.signature.should.deep.equal(sig);
    });

    it('should have a matchin pubKey with bitcore', function() {
      const sig = sig0.getSignature();
      const xpub = party0TssKey.getXPubKey();
      const pubKey = BitcoreLib.HDPublicKey(xpub).deriveChild(derivationPath || 'm').publicKey.toString('hex');
      sig.pubKey.should.equal(pubKey);
    });

    it('should not export a completed session', function() {
      should.throw(() => { sig0.exportSession(); }, /Cannot export a completed session/);
    });

    it('should cleanly handle a subscription to a finished session', async function() {
      sandbox.spy(sig0, 'emit');
      const complete = new Promise(r => sig0.once('complete', r));
      sig0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
      await complete;
      sig0.emit.args.filter(o => o[0] === 'roundready').length.should.equal(0);
      sig0.emit.args.filter(o => o[0] === 'signature').length.should.equal(1);
      sig0.emit.args.filter(o => o[0] === 'complete').length.should.equal(1);
    });

    it('should emit the signature for an outdated local but finished remote session', async function() {
      const sig0 = await new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party0Creds,
        tssKey: party0TssKey,
      }).restoreSession({ session: export0 });
      const emitSpy = sandbox.spy(sig0, 'emit');
      const signature = new Promise(r => sig0.once('signature', r));
      const complete = new Promise(r => sig0.once('complete', r));
      sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
      const sig = await signature;
      await complete;
      should.exist(sig);
      emitSpy.args.filter(o => o[0] === 'roundready').length.should.equal(1);
      emitSpy.args.filter(o => o[0] === 'roundprocessed').length.should.equal(1);
      emitSpy.args.filter(o => o[0] === 'roundsubmitted').length.should.equal(0); // b/c body.signature exists
    });

    it('should sign a message with a custom id', async function() {
      const sig0 = new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party0Creds,
        tssKey: party0TssKey,
      });
      const sig2 = new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party2Creds,
        tssKey: party2TssKey,
      });
      const id = 'my-custom-id';
      await sig0.start({ id, messageHash, derivationPath });
      await sig2.start({ id, messageHash, derivationPath });
      const complete0 = new Promise(r => sig0.once('complete', r));
      const complete2 = new Promise(r => sig2.once('complete', r));
      sig0.subscribe({ timeout: 10 });
      sig2.subscribe({ timeout: 10 });
      await Promise.all([complete0, complete2]);
      const sig = sig0.getSignature();
      should.exist(sig);
    });

    it('should error on a duplicate session id', async function() {
      const sig0 = new TssSign({
        baseUrl: '/bws/api',
        request: request(app),
        credentials: party0Creds,
        tssKey: party0TssKey,
      });
      try {
        await sig0.start({ messageHash });
        throw new Error('Should have thrown');
      } catch (err) {
        err.message.should.include('TSS_ROUND_ALREADY_DONE');
      }
    });
  
  });

  describe('TssKey', function() {
    const expectedPrivateKeyShare = Buffer.from('aabbccdd00112233aabbccdd00112233aabbccdd00112233aabbccdd00112233', 'hex');
    const expectedReducedPrivateKeyShare = Buffer.from('11223344aabbccdd11223344aabbccdd11223344aabbccdd11223344aabbccdd', 'hex');

    function createTssKey(): TssKey {
      const key = new Key({ seedType: 'new' });
      return new TssKey({
        ...key.toObj(),
        keychain: {
          privateKeyShare: expectedPrivateKeyShare,
          privateKeyShareEncrypted: null,
          reducedPrivateKeyShare: expectedReducedPrivateKeyShare,
          reducedPrivateKeyShareEncrypted: null,
          commonKeyChain: '03' + 'aabbccdd00112233'.repeat(6),
        },
        metadata: { id: 'test-tss-id', m: 2, n: 3, partyId: 0 },
      });
    }

    describe('toObj', function() {
      describe('buffer serialization', function () {
        function assertKeychainBuffers(tssKey: TssKey) {
          Buffer.isBuffer(tssKey.keychain.privateKeyShare).should.be.true;
          Buffer.isBuffer(tssKey.keychain.reducedPrivateKeyShare).should.be.true;
        }

        it('should return Buffer instances in the keychain after toObj()', function () {
          const tssKey = createTssKey();
          assertKeychainBuffers(tssKey);
          Buffer.compare(tssKey.keychain.privateKeyShare, expectedPrivateKeyShare).should.equal(0);
          Buffer.compare(tssKey.keychain.reducedPrivateKeyShare, expectedReducedPrivateKeyShare).should.equal(0);

          const exported = tssKey.toObj();

          Buffer.isBuffer(exported.keychain.privateKeyShare).should.be.true;
          Buffer.isBuffer(exported.keychain.reducedPrivateKeyShare).should.be.true;

          // Ensure that the exported buffers are not the same references as the original TssKey buffers
          exported.keychain.privateKeyShare.should.not.equal(tssKey.keychain.privateKeyShare);
          exported.keychain.reducedPrivateKeyShare.should.not.equal(tssKey.keychain.reducedPrivateKeyShare);
        });

        it('should preserve buffer contents after toObj()', function () {
          const tssKey = createTssKey();
          assertKeychainBuffers(tssKey);

          const exported = tssKey.toObj();

          Buffer.isBuffer(exported.keychain.privateKeyShare).should.be.true;
          Buffer.isBuffer(exported.keychain.reducedPrivateKeyShare).should.be.true;

          Buffer.compare(exported.keychain.privateKeyShare, expectedPrivateKeyShare).should.equal(0);
          Buffer.compare(exported.keychain.reducedPrivateKeyShare, expectedReducedPrivateKeyShare).should.equal(0);
        });

        it('should survive a full JSON.stringify → JSON.parse round-trip', function () {
          const tssKey = createTssKey();
          assertKeychainBuffers(tssKey);

          const exported = tssKey.toObj();
          const serialized = JSON.stringify(exported);
          const loaded = JSON.parse(serialized, (key, value) => {
            if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
              return Buffer.from(value.data);
            }
            return value;
          });

          Buffer.isBuffer(loaded.keychain.privateKeyShare).should.be.true;
          Buffer.isBuffer(loaded.keychain.reducedPrivateKeyShare).should.be.true;

          Buffer.compare(loaded.keychain.privateKeyShare, expectedPrivateKeyShare).should.equal(0);
          Buffer.compare(loaded.keychain.reducedPrivateKeyShare, expectedReducedPrivateKeyShare).should.equal(0);
        });

        it('should allow constructing a new TssKey from toObj() output with valid Buffers', function () {
          const tssKey = createTssKey();
          assertKeychainBuffers(tssKey);

          const exported = tssKey.toObj();
          const reconstructed = new TssKey(exported);

          assertKeychainBuffers(reconstructed);
          Buffer.compare(reconstructed.keychain.privateKeyShare, expectedPrivateKeyShare).should.equal(0);
          Buffer.compare(reconstructed.keychain.reducedPrivateKeyShare, expectedReducedPrivateKeyShare).should.equal(0);
        });
      });
    });
  });

  describe('Client Versions', function() {
    // Intercepts Request.prototype.post and overrides the `version` field.
    // Pass `undefined` to omit version entirely (simulates pre-v1.1 legacy clients).
    function stubPostVersion(version: number | undefined) {
      const origPost = Request.prototype.post;
      return sandbox.stub(Request.prototype, 'post').callsFake(function(url, body: any, cb) {
        if (version !== undefined) {
          return origPost.call(this, url, { ...body, version }, cb);
        } else {
          const { version: _v, ...rest } = body;
          return origPost.call(this, url, rest, cb);
        }
      });
    }

    describe('Key Generation', function() {
      for (const [creatorVersion, joinerVersion] of [[1.2, 1.3], [1.3, 1.2]]) {
        it(`should reject scheme ${joinerVersion} joining scheme ${creatorVersion} before key generation`, async function() {
          const creatorKey = new Key({ seedType: 'new' });
          const joinerKey = new Key({ seedType: 'new' });
          const tss0 = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key: creatorKey });
          const tss1 = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key: joinerKey });
          const creatorStub = stubPostVersion(creatorVersion);
          await tss0.newKey({ m, n });
          const code = await tss0.createJoinCode({
            partyId: 1,
            partyPubKey: joinerKey.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
          });
          creatorStub.restore();
          stubPostVersion(joinerVersion);
          const err = await tss1.joinKey({ code }).then(() => null, e => e);
          should.exist(err);
          err.message.should.include('TSS_MISMATCH_VERSION');
          (await storage.fetchTssKeyGenSession({ id: tss0.id })).participants.filter(Boolean).should.have.length(1);
        });
      }

      it('should reject a too-old client version', async function() {
        stubPostVersion(0.9);
        const key = new Key({ seedType: 'new' });
        const tss = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
        try {
          await tss.newKey({ m, n });
          throw new Error('Should have thrown');
        } catch (err) {
          err.name.should.include('UPGRADE_NEEDED');
        }
      });

      it('should reject a too-new client version', async function() {
        stubPostVersion(2.0);
        const key = new Key({ seedType: 'new' });
        const tss = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
        try {
          await tss.newKey({ m, n });
          throw new Error('Should have thrown');
        } catch (err) {
          err.name.should.include('UPGRADE_NEEDED');
          err.message.should.include('TSS version too new');
        }
      });

      it('should accept a legacy client that omits the version field', async function() {
        // Pre-v1.1 clients did not send the version; the server defaults to 1.0
        stubPostVersion(undefined);
        const key = new Key({ seedType: 'new' });
        const tss = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
        const result = await tss.newKey({ m, n });
        should.exist(result);
        result.should.equal(tss);
      });

      it('should reject a version mismatch when joining a session', async function() {
        // Party 0 creates with the current version; party 1 tries to join with an old version.
        const party0Key = new Key({ seedType: 'new' });
        const party1Key = new Key({ seedType: 'new' });
        const tss0 = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key: party0Key });
        await tss0.newKey({ m, n });

        const joinCode = await tss0.createJoinCode({
          partyId: 1,
          partyPubKey: party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
        });

        stubPostVersion(1.0);
        const tss1 = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key: party1Key });
        try {
          await tss1.joinKey({ code: joinCode });
          throw new Error('Should have thrown');
        } catch (err) {
          err.message.should.include('TSS_MISMATCH_VERSION');
        }
      });
    });

    describe('Signing', function() {
      let vParty0TssKey: TssKey;
      let vParty1TssKey: TssKey;
      let vParty0Creds: Credentials;
      let vParty1Creds: Credentials;
      const vMessageHash = BitcoreLib.crypto.Hash.sha256(Buffer.from('client-version-test'));
      const vDerivPath = 'm/0/0';

      function objToBuf(_key, value) {
        if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
          return Buffer.from(value.data);
        }
        return value;
      }

      before(async function() {
        ({ tss: vParty0TssKey } = JSON.parse(fs.readFileSync(`${datadir}/tss-party0.json`).toString(), objToBuf));
        ({ tss: vParty1TssKey } = JSON.parse(fs.readFileSync(`${datadir}/tss-party1.json`).toString(), objToBuf));
        vParty0TssKey = new TssKey(vParty0TssKey);
        vParty1TssKey = new TssKey(vParty1TssKey);
        vParty0Creds = vParty0TssKey.createCredentials(null, { chain, network: 'testnet', account: 0 });
        vParty1Creds = vParty1TssKey.createCredentials(null, { chain, network: 'testnet', account: 0 });
        
        // Wallets for these keys were already created in the Signing suite's before()
        // The below is in case of testing a .only run of this suite.
        const session = await storage.fetchTssKeyGenSession({ id: vParty0TssKey.metadata.id });
        if (!session) {
          await storage.storeTssKeyGenSession({
            doc: {
              id: vParty0TssKey.metadata.id,
              participants: [
                vParty0Creds.copayerId,
                vParty1Creds.copayerId
              ],
              sharedPublicKey: vParty0TssKey.keychain.commonKeyChain,
            }
          });
        
          const client = helpers.newClient(app);
          for (const tssKey of [vParty0TssKey, vParty1TssKey]) {
            await helpers.createAndJoinWallet(
              [client, client, client],
              [tssKey],
              1,
              1,
              {
                key: tssKey,
                coin: chain.toLowerCase(),
                tssKeyId: tssKey.metadata.id
              }
            );
          }
        }
      });

      it('should reject a too-old client version', async function() {
        stubPostVersion(0.9);
        const sig = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: vParty0Creds, tssKey: vParty0TssKey });
        try {
          await sig.start({ id: 'version-old-sign', messageHash: vMessageHash, derivationPath: vDerivPath });
          throw new Error('Should have thrown');
        } catch (err) {
          err.name.should.include('UPGRADE_NEEDED');
        }
      });

      it('should reject a too-new client version', async function() {
        stubPostVersion(2.0);
        const sig = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: vParty0Creds, tssKey: vParty0TssKey });
        try {
          await sig.start({ id: 'version-new-sign', messageHash: vMessageHash, derivationPath: vDerivPath });
          throw new Error('Should have thrown');
        } catch (err) {
          err.name.should.include('UPGRADE_NEEDED');
          err.message.should.include('TSS version too new');
        }
      });

      it('should accept a legacy client that omits the version field', async function() {
        // Pre-v1.1 clients did not send the version; the server defaults to 1.0
        stubPostVersion(undefined);
        const sig0 = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: vParty0Creds, tssKey: vParty0TssKey });
        const sig1 = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: vParty1Creds, tssKey: vParty1TssKey });
        await sig0.start({ id: 'version-legacy-sign', messageHash: vMessageHash, derivationPath: vDerivPath });
        await sig1.start({ id: 'version-legacy-sign', messageHash: vMessageHash, derivationPath: vDerivPath });
        // No error: server treats missing version as 1.0, both sessions match
      });

      it('should reject a version mismatch when joining a signing session', async function() {
        // Party 0 creates with current version (1.1); party 1 tries to join with old version (1.0)
        const sig0 = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: vParty0Creds, tssKey: vParty0TssKey });
        await sig0.start({ id: 'version-mismatch-sign', messageHash: vMessageHash, derivationPath: vDerivPath });

        stubPostVersion(1.0);
        const sig1 = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: vParty1Creds, tssKey: vParty1TssKey });
        try {
          await sig1.start({ id: 'version-mismatch-sign', messageHash: vMessageHash, derivationPath: vDerivPath });
          throw new Error('Should have thrown');
        } catch (err) {
          err.message.should.include('TSS_MISMATCH_VERSION');
        }
      });
    });
  });

  describe('Session Expiration', function() {
    // Stubs Date.now() past the server's 20-minute default time limit
    function simulateExpiry(mins) {
      const now = Date.now();
      sandbox.stub(Date, 'now').returns(now + mins * 60 * 1000);
    }

    describe('Key Generation', function() {
      let tss0: TssKeyGen;
      let tss1: TssKeyGen;
      let tss2: TssKeyGen;

      beforeEach(async function() {
      });

      it('should emit an error when subscribing to an expired keygen session', async function() {
        const data = JSON.parse(fs.readFileSync(`${datadir}/initialKeyGenState.json`).toString());
        const key0 = new Key({ seedType: 'mnemonic', seedData: data.party0Mnemonic });
        const key1 = new Key({ seedType: 'mnemonic', seedData: data.party1Mnemonic });
        const key2 = new Key({ seedType: 'mnemonic', seedData: data.party2Mnemonic });
        tss0 = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key: key0 });
        tss1 = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key: key1 });
        tss2 = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key: key2 });
        await tss0.restoreSession({ session: data.party0Session });
        await tss1.restoreSession({ session: data.party1Session });
        await tss2.restoreSession({ session: data.party2Session });
        await storage.storeTssKeyGenSession({ doc: data.keygenModel });

        simulateExpiry(BwsDefaults.TSS_KEYGEN_TIME_LIMIT + 1); // 1 minute past the default limit

        const error0 = new Promise<IErrorSpec>(r => tss0.once('error', (e) => { tss0.unsubscribe(); r(e); }));
        tss0.subscribe({ timeout: 10, iterHandler: () => tss0.unsubscribe() });
        const error1 = new Promise<Error>(r => tss1.once('error', (e) => { tss1.unsubscribe(); r(e); }));
        tss1.subscribe({ timeout: 10, iterHandler: () => tss1.unsubscribe() });
        const error2 = new Promise<Error>(r => tss2.once('error', (e) => { tss2.unsubscribe(); r(e); }));
        tss2.subscribe({ timeout: 10, iterHandler: () => tss2.unsubscribe() });
        
        const err0 = await error0;
        err0.name.should.include('TSS_SESSION_EXPIRED');
        const err1 = await error1;
        err1.name.should.include('TSS_SESSION_EXPIRED');
        const err2 = await error2;
        err2.name.should.include('TSS_SESSION_EXPIRED');
      });

      it('should not expire a session before the time limit is reached', async function() {
        const key = new Key({ seedType: 'new' });
        const tss = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
        await tss.newKey({ m, n });

        simulateExpiry(BwsDefaults.TSS_KEYGEN_TIME_LIMIT - 1); // 1 minute before the default limit

        // If the session were expired, an error event would fire and fail this test
        tss.on('error', (e) => { should.not.exist(e?.message ?? e); });
        await new Promise<void>(r => tss.subscribe({ timeout: 10, iterHandler: () => { tss.unsubscribe(); r(); } }));
      });
    });

    describe('Signing', function() {
      let eParty0TssKey: TssKey;
      let eParty1TssKey: TssKey;
      let eParty0Creds;
      let eParty1Creds;
      const eMessageHash = BitcoreLib.crypto.Hash.sha256(Buffer.from('expiry-test'));
      const eDerivPath = 'm/0/0';

      function objToBuf(_key, value) {
        if (value && value.type === 'Buffer' && Array.isArray(value.data)) {
          return Buffer.from(value.data);
        }
        return value;
      }

      before(async function() {
        ({ tss: eParty0TssKey } = JSON.parse(fs.readFileSync(`${datadir}/tss-party0.json`).toString(), objToBuf));
        ({ tss: eParty1TssKey } = JSON.parse(fs.readFileSync(`${datadir}/tss-party1.json`).toString(), objToBuf));
        eParty0TssKey = new TssKey(eParty0TssKey);
        eParty1TssKey = new TssKey(eParty1TssKey);
        eParty0Creds = eParty0TssKey.createCredentials(null, { chain, network: 'testnet', account: 0 });
        eParty1Creds = eParty1TssKey.createCredentials(null, { chain, network: 'testnet', account: 0 });

        // Wallets for these keys were already created in the Signing suite's before()
        // The below is in case of testing a .only run of this suite.
        const session = await storage.fetchTssKeyGenSession({ id: eParty0TssKey.metadata.id });
        if (!session) {
          await storage.storeTssKeyGenSession({
            doc: {
              id: eParty0TssKey.metadata.id,
              participants: [eParty0Creds.copayerId, eParty1Creds.copayerId],
              sharedPublicKey: eParty0TssKey.keychain.commonKeyChain,
            }
          });
          const client = helpers.newClient(app);
          for (const tssKey of [eParty0TssKey, eParty1TssKey]) {
            await helpers.createAndJoinWallet(
              [client, client, client],
              [tssKey],
              1,
              1,
              { key: tssKey, coin: chain.toLowerCase(), tssKeyId: tssKey.metadata.id }
            );
          }
        }
      });

      it('should emit an error when subscribing to an expired signing session', async function() {
        const sig0 = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: eParty0Creds, tssKey: eParty0TssKey });
        const sig1 = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: eParty1Creds, tssKey: eParty1TssKey });
        await sig0.start({ id: 'expiry-sign', messageHash: eMessageHash, derivationPath: eDerivPath });
        await sig1.start({ id: 'expiry-sign', messageHash: eMessageHash, derivationPath: eDerivPath });

        simulateExpiry(BwsDefaults.TSS_SIGGEN_TIME_LIMIT + 1); // 1 minute past the default limit

        const error = new Promise<IErrorSpec>(r => sig0.once('error', (e) => { sig0.unsubscribe(); r(e); }));
        sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
        const err = await error;
        err.name.should.include('TSS_SESSION_EXPIRED');
      });

      it('should not expire a signing session before the time limit is reached', async function() {
        const sig0 = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: eParty0Creds, tssKey: eParty0TssKey });
        const sig1 = new TssSign({ baseUrl: '/bws/api', request: request(app), credentials: eParty1Creds, tssKey: eParty1TssKey });
        await sig0.start({ id: 'expiry-sign-valid', messageHash: eMessageHash, derivationPath: eDerivPath });
        await sig1.start({ id: 'expiry-sign-valid', messageHash: eMessageHash, derivationPath: eDerivPath });

        simulateExpiry(BwsDefaults.TSS_SIGGEN_TIME_LIMIT - 1); // 1 minute before the default limit

        const response0 = new Promise(r => sig0.once('roundsubmitted', r));
        const response1 = new Promise(r => sig1.once('roundsubmitted', r));
        sig0.on('error', (e) => { should.not.exist(e?.message ?? e); });
        sig1.on('error', (e) => { should.not.exist(e?.message ?? e); });
        sig0.subscribe({ timeout: 10, iterHandler: () => sig0.unsubscribe() });
        sig1.subscribe({ timeout: 10, iterHandler: () => sig1.unsubscribe() });
        const round0 = await response0;
        const round1 = await response1;
        round0.should.equal(1);
        round1.should.equal(1);
      });
    });
  });
});
