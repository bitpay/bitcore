'use strict';

import assert from 'assert';
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
import { Credentials as RealCredentials } from '../src/lib/credentials';
import { Request, getRequestErrorStatus } from '../src/lib/request';
import { BitcoreLib, Deriver } from '@bitpay-labs/crypto-wallet-core';
import { TssKeyGen, TssKey, type RestoreTrustedInputs } from '../src/lib/tsskey';
import { decryptJoinDelivery, encryptJoinDelivery } from '../src/lib/tssdelivery';
import { Errors } from '../src/lib/errors';
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
      sandbox.stub(Request.prototype, 'post').callsFake(function(url, body: any, cb) {
        if (version !== undefined) {
          return origPost.call(this, url, { ...body, version }, cb);
        } else {
          const { version: _v, ...rest } = body;
          return origPost.call(this, url, rest, cb);
        }
      });
    }

    describe('Key Generation', function() {
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
        // Party 0 creates with current version (1.1); party 1 tries to join with old version (1.0)
        const party0Key = new Key({ seedType: 'new' });
        const party1Key = new Key({ seedType: 'new' });
        const tss0 = new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key: party0Key });
        await tss0.newKey({ m, n }); // real version, creates session with schemeVersion 1.1

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
  describe('Invitation delivery trust', function() {
    const mk = (key) => new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
    const pubKeyOf = (key) => key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey;
    const compressed = (hex: string) => BitcoreLib.PublicKey.fromPoint(new BitcoreLib.PublicKey(hex).point, true).toString();
    const uncompressed = (hex: string) => BitcoreLib.PublicKey.fromPoint(new BitcoreLib.PublicKey(hex).point, false).toString();
    // The request public key each party enrolled with at BWS, indexed by partyId
    const sessionKeysOf = async (id: string) => {
      const session = await storage.fetchTssKeyGenSession({ id });
      const keys = [];
      for (const r of session.rounds[0]) {
        keys[r.fromPartyId] = r.messages.publicKey;
      }
      return keys;
    };
    let creator: TssKeyGen;
    let invitee: TssKeyGen;
    let creatorKey;
    let inviteeKey;
    let otherKey;

    beforeEach(async function() {
      creatorKey = new Key({ seedType: 'new' });
      inviteeKey = new Key({ seedType: 'new' });
      otherKey = new Key({ seedType: 'new' });
      creator = mk(creatorKey);
      invitee = mk(inviteeKey);
      await creator.newKey({ m: 2, n: 2 });
    });

    afterEach(function() {
      creator?.unsubscribe();
      invitee?.unsubscribe();
    });

    describe('creator', function() {
      it(happyPath('should retain the party/key assignment from the join code'), async function() {
        const code = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey) });
        await invitee.joinKey({ code });
        creator.verifyDeliveryBindings(await sessionKeysOf(creator.id));
      });

      describe('equivalent public key encodings', function() {
        this.timeout(30000);

        const encodings: Record<string, (hex: string) => string> = {
          compressed,
          uppercase: hex => hex.toUpperCase(),
          uncompressed
        };

        for (const [name, encode] of Object.entries(encodings)) {
          it(`should register, retain, and deliver to a recipient given as ${name}`, async function() {
            // Fresh keys: the session ID is deterministic, so reusing the beforeEach pair would collide
            const keyA = new Key({ seedType: 'new' });
            const keyB = new Key({ seedType: 'new' });
            const tssA = mk(keyA);
            const tssB = mk(keyB);
            try {
              await tssA.newKey({ m: 2, n: 2 });
              const pub = pubKeyOf(keyB);
              const code = await tssA.createJoinCode({ partyId: 1, partyPubKey: encode(pub) });

              // BWS holds the canonical key rather than the caller's spelling
              const session = await storage.fetchTssKeyGenSession({ id: tssA.id });
              session.authPublicKeys[1].should.equal(compressed(pub));

              await tssB.joinKey({ code });
              tssB.partyId.should.equal(1);
              // The local trust matches the registered key, whichever encoding was supplied
              tssA.verifyDeliveryBindings(await sessionKeysOf(tssA.id));

              // The intended participant joins, and the encrypted delivery reaches it
              const errors = [];
              tssA.on('error', e => errors.push(e));
              tssB.on('error', e => errors.push(e));
              const creatorWallet = new Promise<any>(r => tssA.once('wallet', r));
              const recipientWallet = new Promise<any>(r => tssB.once('wallet', r));
              tssA.subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
              tssB.subscribe({ timeout: 10, copayerName: 'recipient' });
              const [created, joined] = await Promise.all([creatorWallet, recipientWallet]);
              joined.id.should.equal(created.id);
              errors.should.deep.equal([]);
              const stored = await new Promise<any>((resolve, reject) => {
                storage.fetchWallet(created.id, (err, w) => err ? reject(err) : resolve(w));
              });
              stored.copayers.length.should.equal(2);
            } finally {
              tssA.unsubscribe();
              tssB.unsubscribe();
            }
          });
        }
      });

      it('should not retain trust for invalid keys or party IDs', async function() {
        await assert.rejects(creator.createJoinCode({ partyId: 1, partyPubKey: 'zz' }), /Invalid partyPubKey/);
        await assert.rejects(creator.createJoinCode({ partyId: 1, partyPubKey: '02' + '00'.repeat(32) }), /Invalid partyPubKey/);
        await assert.rejects(creator.createJoinCode({ partyId: 0, partyPubKey: pubKeyOf(inviteeKey) }), /partyId/);
        await assert.rejects(creator.createJoinCode({ partyId: 2, partyPubKey: pubKeyOf(inviteeKey) }), /partyId/);
        should.throw(() => creator.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted public key for party 1/);
      });

      it('should not retain trust when registration is rejected for a first invitation', async function() {
        const realPost = Request.prototype.post;
        sandbox.stub(Request.prototype, 'post').callsFake(function(this: Request, url: string, ...rest: any[]) {
          if (url.endsWith('/register')) {
            return Promise.reject(new Error('registration unavailable'));
          }
          return (realPost as any).call(this, url, ...rest);
        });
        await assert.rejects(creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey) }), /registration unavailable/);
        should.throw(() => creator.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted public key for party 1/);
        const session = await storage.fetchTssKeyGenSession({ id: creator.id });
        should.not.exist(session.authPublicKeys[1]);
      });

      it('should report missing bindings', function() {
        should.throw(() => creator.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted public key for party 1/);
      });

      it('should detect a session key that disagrees with the retained key and not adopt it', async function() {
        await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey) });
        should.throw(() => creator.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(otherKey)]), /party 1 does not match/);
        should.throw(() => creator.verifyDeliveryBindings([pubKeyOf(creatorKey)]), /no public key for party 1/);
        should.throw(() => creator.verifyDeliveryBindings([pubKeyOf(otherKey), pubKeyOf(inviteeKey)]), /party 0 does not match/);
        // The retained key is unchanged by the failed checks
        creator.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]);
      });

      it('should replace the key when a join code is reissued for the same party', async function() {
        // Before the recipient has enrolled, the creator can still correct a mistyped key
        await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(otherKey) });
        const code = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey) });
        await invitee.joinKey({ code });

        const keys = await sessionKeysOf(creator.id);
        keys[1].should.equal(compressed(pubKeyOf(inviteeKey)));
        keys[1].should.not.equal(compressed(pubKeyOf(otherKey)));
        const session = await storage.fetchTssKeyGenSession({ id: creator.id });
        session.authPublicKeys.should.not.include(compressed(pubKeyOf(otherKey)));
        creator.verifyDeliveryBindings(keys);
      });
    });

    describe('invitee', function() {
      it(happyPath('should retain the creator key and ceremony context from a normal join code'), async function() {
        const code = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey) });
        await invitee.joinKey({ code });
        invitee.id.should.equal(creator.id);
        invitee.partyId.should.equal(1);
        invitee.m.should.equal(2);
        invitee.n.should.equal(2);
        invitee.verifyDeliveryBindings(await sessionKeysOf(creator.id));
        should.throw(() => invitee.verifyDeliveryBindings([pubKeyOf(otherKey), pubKeyOf(inviteeKey)]), /party 0 does not match/);
        should.throw(() => invitee.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(otherKey)]), /party 1 does not match/);
      });

      it('should report a missing creator key before joining', function() {
        should.throw(() => invitee.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted creator public key/);
      });

      it('should not retain trust from an invalid join code', async function() {
        const code = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(otherKey) });
        try {
          await invitee.joinKey({ code });
          throw new Error('Should have failed');
        } catch (err) {
          err.message.should.equal('Invalid checksum');
        }
        should.throw(() => invitee.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted creator public key/);
      });

      it(happyPath('should accept a normal join code when the expected creator key matches'), async function() {
        const code = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey) });
        await invitee.joinKey({ code, creatorPubKey: uncompressed(creator.getAuthPublicKey()) });
        invitee.verifyDeliveryBindings(await sessionKeysOf(creator.id));
      });

      it('should reject a normal join code issued by a different creator key than expected', async function() {
        const code = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey) });
        try {
          await invitee.joinKey({ code, creatorPubKey: pubKeyOf(otherKey) });
          throw new Error('Should have failed');
        } catch (err) {
          err.message.should.equal('Join code was not issued by the expected creator key');
        }
        should.throw(() => invitee.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted creator public key/);
      });

      describe('malformed invitation contents', function() {
        // Hand-build a correctly encrypted invitation from the real creator key with arbitrary plaintext
        const buildCode = (fields: Array<string | number>) => {
          const creatorPrivKey = creatorKey.createCredentials(null, { chain, network, n: 1, account: 0 }).requestPrivKey;
          return ECIES.encrypt({
            message: fields.join(':'),
            publicKey: pubKeyOf(inviteeKey),
            privateKey: creatorPrivKey
          }).toString('hex');
        };
        const wellFormed = () => [creator.id, 1, 'eth', 'livenet', 2, 2, ''];

        it('should accept a well-formed hand-built invitation', async function() {
          // The creator registers the recipient's key when issuing an invitation, so the hand-built one is only
          // acceptable for a recipient that was legitimately registered first.
          await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey) });
          const code = buildCode(wellFormed());
          invitee.checkJoinCode({ code }).should.deep.equal({ id: creator.id, partyId: 1, chain: 'eth', network: 'livenet', m: 2, n: 2 });
          await invitee.joinKey({ code });
          invitee.verifyDeliveryBindings(await sessionKeysOf(creator.id));
        });

        const cases: Array<[string, (f: Array<string | number>) => Array<string | number>]> = [
          ['an empty session id', f => { f[0] = ''; return f; }],
          ['an empty chain', f => { f[2] = ''; return f; }],
          ['an unknown network', f => { f[3] = 'mainnet'; return f; }],
          ['an empty network', f => { f[3] = ''; return f; }],
          ['a fractional partyId', f => { f[1] = '1.5'; return f; }],
          ['a fractional m', f => { f[4] = '1.5'; return f; }],
          ['a fractional n', f => { f[5] = '2.5'; return f; }],
          ['a non-numeric m', f => { f[4] = 'two'; return f; }],
          ['a negative partyId', f => { f[1] = '-1'; return f; }],
          ['the creator partyId (0)', f => { f[1] = 0; return f; }],
          ['a partyId outside the ceremony (>= n)', f => { f[1] = 2; return f; }],
          ['m of zero', f => { f[4] = 0; return f; }],
          ['m greater than n', f => { f[4] = 3; return f; }],
          ['missing ceremony fields', f => f.slice(0, 4)]
        ];

        for (const [name, mutate] of cases) {
          it(`should reject an invitation with ${name} without establishing trust`, async function() {
            const code = buildCode(mutate(wellFormed()));
            should.throw(() => invitee.checkJoinCode({ code }), /Invalid join code/);
            try {
              await invitee.joinKey({ code });
              throw new Error('Should have failed');
            } catch (err) {
              err.message.should.include('Invalid join code');
            }
            // No ceremony state, trust, or session enrollment results from the rejected invitation
            should.not.exist(invitee.id);
            should.not.exist(invitee.partyId);
            should.throw(() => invitee.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted creator public key/);
            const session = await storage.fetchTssKeyGenSession({ id: creator.id });
            should.not.exist(session.participants[1]);
          });
        }
      });

      describe('noKey join code', function() {
        let code: string;
        beforeEach(async function() {
          code = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(inviteeKey), opts: { noKey: true } });
        });

        it(happyPath('should work with the expected creator key and retain it'), async function() {
          invitee.checkJoinCode({ code, opts: { noKey: true }, creatorPubKey: creator.getAuthPublicKey() }).id.should.equal(creator.id);
          await invitee.joinKey({ code, opts: { noKey: true }, creatorPubKey: creator.getAuthPublicKey() });
          invitee.id.should.equal(creator.id);
          invitee.verifyDeliveryBindings(await sessionKeysOf(creator.id));
        });

        it('should fail explicitly without the creator key', async function() {
          should.throw(() => invitee.checkJoinCode({ code, opts: { noKey: true } }), /creatorPubKey is required/);
          try {
            await invitee.joinKey({ code, opts: { noKey: true } });
            throw new Error('Should have failed');
          } catch (err) {
            err.message.should.include('creatorPubKey is required');
          }
          should.throw(() => invitee.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted creator public key/);
        });

        it('should fail with the wrong creator key', async function() {
          try {
            await invitee.joinKey({ code, opts: { noKey: true }, creatorPubKey: pubKeyOf(otherKey) });
            throw new Error('Should have failed');
          } catch (err) {
            err.message.should.equal('Invalid checksum');
          }
          should.throw(() => invitee.verifyDeliveryBindings([pubKeyOf(creatorKey), pubKeyOf(inviteeKey)]), /Missing trusted creator public key/);
        });

        it('should reject an invalid creator key', function() {
          should.throw(() => invitee.checkJoinCode({ code, opts: { noKey: true }, creatorPubKey: 'nope' }), /Invalid creatorPubKey/);
        });
      });
    });
  });

  describe('Session restore delivery trust', function() {
    const WRAPPER_PREFIX = 'tsskeygen.1.';
    const mk = (key, opts: { chain?: string } = {}) => new TssKeyGen({ chain: opts.chain || chain, network, baseUrl: '/bws/api', request: request(app), key });
    const credsOf = (key) => key.createCredentials(null, { network, n: 1, account: 0 });
    const pubKeyOf = (key) => credsOf(key).requestPubKey;
    const sessionKeysOf = async (id: string) => {
      const session = await storage.fetchTssKeyGenSession({ id });
      const keys = [];
      for (const r of session.rounds[0]) {
        keys[r.fromPartyId] = r.messages.publicKey;
      }
      return keys;
    };
    // Decrypt a wrapped export with the party's request key, change it, and encrypt it back (as the party itself would)
    const rewrap = (exported: string, key, mutate: (wrapper: any) => void) => {
      const priv = new BitcoreLib.PrivateKey(credsOf(key).requestPrivKey);
      const wrapper = JSON.parse(TssUtils.decrypt(Buffer.from(exported.slice(WRAPPER_PREFIX.length), 'base64'), priv.publicKey, priv).toString());
      mutate(wrapper);
      return WRAPPER_PREFIX + TssUtils.encrypt(Buffer.from(JSON.stringify(wrapper)), priv.publicKey, priv).toString('base64');
    };
    const unwrap = (exported: string, key): string => {
      let legacy: string;
      rewrap(exported, key, (w) => { legacy = w.session; });
      return legacy;
    };

    let creator: TssKeyGen;
    let inviteeA: TssKeyGen;
    let inviteeB: TssKeyGen;
    let creatorKey;
    let keyA;
    let keyB;
    let otherKey;
    let codeA: string;
    let codeB: string;
    let sessionKeys: string[];

    beforeEach(async function() {
      creatorKey = new Key({ seedType: 'new' });
      keyA = new Key({ seedType: 'new' });
      keyB = new Key({ seedType: 'new' });
      otherKey = new Key({ seedType: 'new' });
      creator = mk(creatorKey);
      inviteeA = mk(keyA);
      inviteeB = mk(keyB);
      await creator.newKey({ m: 2, n: 3 });
      codeA = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keyA) });
      codeB = await creator.createJoinCode({ partyId: 2, partyPubKey: pubKeyOf(keyB) });
      await inviteeA.joinKey({ code: codeA });
      await inviteeB.joinKey({ code: codeB });
      sessionKeys = await sessionKeysOf(creator.id);
    });

    afterEach(function() {
      creator?.unsubscribe();
      inviteeA?.unsubscribe();
      inviteeB?.unsubscribe();
    });

    describe('round trip', function() {
      it(happyPath('should retain the creator\'s context and recipient keys'), async function() {
        const exported = creator.exportSession();
        exported.startsWith(WRAPPER_PREFIX).should.equal(true);
        const restored = await mk(creatorKey).restoreSession({ session: exported });
        restored.id.should.equal(creator.id);
        restored.partyId.should.equal(0);
        restored.m.should.equal(2);
        restored.n.should.equal(3);
        restored.verifyDeliveryBindings(sessionKeys);
        // Still agrees with the session only for the original keys
        should.throw(() => restored.verifyDeliveryBindings([sessionKeys[0], sessionKeys[1], pubKeyOf(otherKey)]), /party 2 does not match/);
      });

      it(happyPath('should retain the recipient\'s context and creator key'), async function() {
        const restored = await mk(keyA).restoreSession({ session: inviteeA.exportSession() });
        restored.id.should.equal(creator.id);
        restored.partyId.should.equal(1);
        restored.m.should.equal(2);
        restored.n.should.equal(3);
        restored.verifyDeliveryBindings(sessionKeys);
        should.throw(() => restored.verifyDeliveryBindings([pubKeyOf(otherKey), sessionKeys[1], sessionKeys[2]]), /party 0 does not match/);
      });

      it('should keep restoring consistently when the restored instance is exported again', async function() {
        const once = await mk(creatorKey).restoreSession({ session: creator.exportSession() });
        const twice = await mk(creatorKey).restoreSession({ session: once.exportSession() });
        twice.verifyDeliveryBindings(sessionKeys);
      });

      it('should restore a noKey invitation\'s creator key', async function() {
        const soloCreator = mk(otherKey);
        await soloCreator.newKey({ m: 2, n: 2 });
        const invitee = mk(keyA);
        const code = await soloCreator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keyA), opts: { noKey: true } });
        await invitee.joinKey({ code, opts: { noKey: true }, creatorPubKey: soloCreator.getAuthPublicKey() });
        const restored = await mk(keyA).restoreSession({ session: invitee.exportSession() });
        restored.verifyDeliveryBindings(await sessionKeysOf(soloCreator.id));
        soloCreator.unsubscribe();
      });

      it('should not expose the retained keys outside the ciphertext', function() {
        const exported = creator.exportSession();
        const raw = Buffer.from(exported.slice(WRAPPER_PREFIX.length), 'base64').toString('latin1');
        for (const text of [exported, raw]) {
          text.should.not.include(pubKeyOf(keyA));
          text.should.not.include(creator.id);
          text.should.not.include('recipientKeys');
        }
      });
    });

    describe('round rollback', function() {
      it(happyPath('should preserve the bindings and still allow DKG to proceed'), async function() {
        const restoreSpy = sandbox.spy(creator, 'restoreSession');
        const postStub = sandbox.stub(Request.prototype, 'post').throws(new Error('restore me'));
        const rolledBack = new Promise<void>(r => creator.on('error', (e) => {
          if (e.message !== 'restore me') { throw e; }
          postStub.restore();
          r();
        }));
        creator.subscribe({ timeout: 10, iterHandler: () => creator.unsubscribe() });
        await rolledBack;
        restoreSpy.callCount.should.equal(1);
        creator.verifyDeliveryBindings(sessionKeys);

        const submitted = new Promise(r => creator.once('roundsubmitted', r));
        creator.on('error', (e) => { should.not.exist(e?.message ?? e); });
        creator.subscribe({ timeout: 10, iterHandler: () => creator.unsubscribe() });
        (await submitted).should.equal(1);
        creator.verifyDeliveryBindings(sessionKeys);
      });
    });

    describe('invalid restore', function() {
      it('should fail with the wrong request key', async function() {
        const exported = creator.exportSession();
        for (const key of [otherKey, keyA]) {
          await assert.rejects(mk(key).restoreSession({ session: exported }), { message: 'Session could not be decrypted or verified' });
        }
      });

      it('should fail if the wrapper was altered', async function() {
        const exported = creator.exportSession();
        const body = exported.slice(WRAPPER_PREFIX.length);
        const i = Math.floor(body.length / 2);
        const altered = WRAPPER_PREFIX + body.slice(0, i) + (body[i] === 'A' ? 'B' : 'A') + body.slice(i + 1);
        await assert.rejects(mk(creatorKey).restoreSession({ session: altered }), { message: 'Session could not be decrypted or verified' });
      });

      it('should fail if the wrapper was truncated', async function() {
        const exported = creator.exportSession();
        await assert.rejects(
          mk(creatorKey).restoreSession({ session: exported.slice(0, exported.length - 40) }),
          { message: 'Session could not be decrypted or verified' }
        );
      });

      describe('mismatched parameters', function() {
        const fails = (key, exported: string, message: RegExp, opts: { chain?: string } = {}) =>
          assert.rejects(mk(key, opts).restoreSession({ session: exported }), { message });

        it('should fail if the wrapper fields disagree with the wrapped session', async function() {
          const exported = creator.exportSession();
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.m = 3; }), /do not match the wrapped session/);
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.id = 'other'; }), /do not match the wrapped session/);
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.partyId = 1; }), /do not match the wrapped session/);
        });

        it('should fail if the wrapped session disagrees with its DKG state', async function() {
          const exported = creator.exportSession();
          // m is consistent between the wrapper and the wrapped session, but the DKG state was created for m = 2
          await fails(creatorKey, rewrap(exported, creatorKey, w => {
            const parts = w.session.split(':');
            parts[parts.length - 3] = '3';
            w.session = parts.join(':');
            w.m = 3;
          }), /do not match its DKG state/);
        });

        it('should fail for a different request identity, chain or network', async function() {
          const exported = creator.exportSession();
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.requestPubKey = pubKeyOf(otherKey); }), /different request key/);
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.chain = 'btc'; }), /chain or network does not match/);
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.network = 'testnet'; }), /chain or network does not match/);
        });

        it('should fail for an unsupported version or malformed contents', async function() {
          const exported = creator.exportSession();
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.version = 2; }), /unsupported version/);
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.m = '2'; }), /malformed ceremony parameters/);
          await fails(creatorKey, rewrap(exported, creatorKey, w => { w.recipientKeys = 'x'; }), /malformed delivery keys/);
        });

        it('should fail for delivery keys that are malformed or do not belong to the role', async function() {
          const creatorExport = creator.exportSession();
          await fails(creatorKey, rewrap(creatorExport, creatorKey, w => { w.recipientKeys[0].pubKey = 'zz'; }), /malformed delivery keys/);
          await fails(creatorKey, rewrap(creatorExport, creatorKey, w => { w.recipientKeys[0].partyId = 0; }), /malformed delivery keys/);
          await fails(creatorKey, rewrap(creatorExport, creatorKey, w => { w.recipientKeys[1].partyId = 1; }), /malformed delivery keys/);
          await fails(creatorKey, rewrap(creatorExport, creatorKey, w => { w.creatorPubKey = pubKeyOf(otherKey); }), /the creator should not have a creator key/);
          const inviteeExport = inviteeA.exportSession();
          await fails(keyA, rewrap(inviteeExport, keyA, w => { w.creatorPubKey = 'zz'; }), /malformed delivery keys/);
          await fails(keyA, rewrap(inviteeExport, keyA, w => { w.recipientKeys = [{ partyId: 2, pubKey: pubKeyOf(keyB) }]; }), /a recipient has no recipient keys/);
        });

        it('should leave the instance unchanged when a restore fails', async function() {
          await assert.rejects(
            creator.restoreSession({ session: rewrap(creator.exportSession(), creatorKey, w => { w.m = 3; }) }),
            { message: /do not match the wrapped session/ }
          );
          creator.m.should.equal(2);
          creator.verifyDeliveryBindings(sessionKeys);
        });
      });
    });

    describe('wrapper format edge cases', function() {
      const restoreFails = (key, session: string, message: RegExp) =>
        assert.rejects(mk(key).restoreSession({ session }), { message });
      const uncompressed = (hex: string) => BitcoreLib.PublicKey.fromPoint(new BitcoreLib.PublicKey(hex).point, false).toString();

      it('should reject a missing or mistyped session id', async function() {
        const exported = creator.exportSession();
        for (const id of ['', 5, null]) {
          await restoreFails(creatorKey, rewrap(exported, creatorKey, w => { w.id = id; }), /missing session id/);
        }
      });

      it('should reject missing DKG state', async function() {
        await restoreFails(creatorKey, rewrap(creator.exportSession(), creatorKey, w => { w.session = 5; }), /missing DKG state/);
        await restoreFails(creatorKey, rewrap(creator.exportSession(), creatorKey, w => { delete w.session; }), /missing DKG state/);
      });

      it('should reject ceremony parameters out of range', async function() {
        const exported = creator.exportSession();
        await restoreFails(creatorKey, rewrap(exported, creatorKey, w => { w.m = 4; }), /out of range/);
        await restoreFails(creatorKey, rewrap(exported, creatorKey, w => { w.m = 0; }), /out of range/);
        await restoreFails(creatorKey, rewrap(exported, creatorKey, w => { w.partyId = 3; }), /out of range/);
        await restoreFails(creatorKey, rewrap(exported, creatorKey, w => { w.partyId = -1; }), /out of range/);
      });

      it('should reject non-object, null and duplicated recipient key entries without a raw TypeError', async function() {
        const exported = creator.exportSession();
        for (const entries of [[null], [5], ['x'], [undefined]]) {
          await restoreFails(creatorKey, rewrap(exported, creatorKey, w => { w.recipientKeys = entries; }), /^Invalid session: malformed delivery keys$/);
        }
        await restoreFails(creatorKey, rewrap(exported, creatorKey, w => { w.recipientKeys[1].partyId = w.recipientKeys[0].partyId; }), /^Invalid session: malformed delivery keys$/);
      });

      it('should reject retained keys that are valid but not normalized', async function() {
        await restoreFails(creatorKey, rewrap(creator.exportSession(), creatorKey, w => {
          w.recipientKeys[0].pubKey = uncompressed(w.recipientKeys[0].pubKey);
        }), /malformed delivery keys/);
        await restoreFails(keyA, rewrap(inviteeA.exportSession(), keyA, w => {
          w.creatorPubKey = uncompressed(w.creatorPubKey);
        }), /malformed delivery keys/);
      });

      it('should restore a session ID that contains colons', async function() {
        const exported = rewrap(creator.exportSession(), creatorKey, w => {
          const parts = w.session.split(':');
          w.id = 'a:b:c';
          w.session = ['a:b:c', ...parts.slice(-4)].join(':');
        });
        const restored = await mk(creatorKey).restoreSession({ session: exported });
        restored.id.should.equal('a:b:c');
        restored.n.should.equal(3);
        // and survives another export
        (await mk(creatorKey).restoreSession({ session: restored.exportSession() })).id.should.equal('a:b:c');
      });

      it('should round trip a creator that has retained no recipient keys yet', async function() {
        const fresh = mk(otherKey);
        await fresh.newKey({ m: 2, n: 3 });
        const restored = await mk(otherKey).restoreSession({ session: fresh.exportSession() });
        should.throw(() => restored.verifyDeliveryBindings([]), /Missing trusted public key for party 1/);
        fresh.unsubscribe();
      });

      it('should add supplied keys for parties the wrapper did not retain, keeping the retained ones', async function() {
        const exported = rewrap(creator.exportSession(), creatorKey, w => {
          w.recipientKeys = w.recipientKeys.filter(k => k.partyId === 1);
        });
        const restored = await mk(creatorKey).restoreSession({
          session: exported,
          trusted: { recipientKeys: [{ partyId: 2, partyPubKey: pubKeyOf(keyB) }] }
        });
        restored.verifyDeliveryBindings(sessionKeys);
        // The retained key for party 1 still applies
        should.throw(() => restored.verifyDeliveryBindings([sessionKeys[0], pubKeyOf(otherKey), sessionKeys[2]]), /party 1 does not match/);
      });

      it('should reject an empty or non-wrapper string without changing the instance', async function() {
        const idBefore = creator.id;
        await restoreFails(creatorKey, WRAPPER_PREFIX, /could not be decrypted or verified/);
        for (const garbage of ['', 'not-a-session', 'a:0:2:3:!!!']) {
          await assert.rejects(creator.restoreSession({ session: garbage }));
        }
        creator.id.should.equal(idBefore);
        creator.m.should.equal(2);
        creator.verifyDeliveryBindings(sessionKeys);
      });
    });

    describe('legacy export', function() {
      for (const { field, offset, value } of [
        { field: 'm', offset: 3, value: 1 },
        { field: 'n', offset: 2, value: 4 },
        { field: 'partyId', offset: 4, value: undefined }
      ]) {
        it(`should reject legacy ${field} that disagrees with the DKG state before replacing state`, async function() {
          const parties: Array<{ instance: TssKeyGen; key: InstanceType<typeof Key>; trusted: RestoreTrustedInputs }> = [
            {
              instance: creator,
              key: creatorKey,
              trusted: { recipientKeys: [{ partyId: 1, partyPubKey: pubKeyOf(keyA) }, { partyId: 2, partyPubKey: pubKeyOf(keyB) }] }
            },
            { instance: inviteeA, key: keyA, trusted: { joinCode: { code: codeA } } }
          ];
          for (const { instance, key, trusted } of parties) {
            const original = { id: instance.id, partyId: instance.partyId, m: instance.m, n: instance.n };
            const parts = unwrap(instance.exportSession(), key).split(':');
            parts[parts.length - offset] = String(value ?? original.partyId + 1);
            for (const inputs of [undefined, trusted]) {
              await assert.rejects(
                instance.restoreSession({ session: parts.join(':'), trusted: inputs }),
                { message: 'Session ceremony parameters do not match its DKG state' }
              );
              assert.deepStrictEqual(
                { id: instance.id, partyId: instance.partyId, m: instance.m, n: instance.n },
                original
              );
              instance.verifyDeliveryBindings(sessionKeys);
            }
          }
        });
      }

      it('should restore but report missing trust for the creator', async function() {
        const legacy = unwrap(creator.exportSession(), creatorKey);
        legacy.startsWith(WRAPPER_PREFIX).should.equal(false);
        const restored = await mk(creatorKey).restoreSession({ session: legacy });
        restored.id.should.equal(creator.id);
        restored.n.should.equal(3);
        should.throw(() => restored.verifyDeliveryBindings(sessionKeys), /Missing trusted public key for party 1/);
      });

      it('should restore but report missing trust for the recipient', async function() {
        const restored = await mk(keyA).restoreSession({ session: unwrap(inviteeA.exportSession(), keyA) });
        should.throw(() => restored.verifyDeliveryBindings(sessionKeys), /Missing trusted creator public key/);
      });

      it('should drop bindings previously retained by the restored instance', async function() {
        creator.verifyDeliveryBindings(sessionKeys);
        await creator.restoreSession({ session: unwrap(creator.exportSession(), creatorKey) });
        should.throw(() => creator.verifyDeliveryBindings(sessionKeys), /Missing trusted public key for party 1/);
      });

      it(happyPath('should work for the creator once the original recipient keys are supplied'), async function() {
        const legacy = unwrap(creator.exportSession(), creatorKey);
        const restored = await mk(creatorKey).restoreSession({
          session: legacy,
          trusted: { recipientKeys: [{ partyId: 1, partyPubKey: pubKeyOf(keyA) }, { partyId: 2, partyPubKey: pubKeyOf(keyB) }] }
        });
        restored.verifyDeliveryBindings(sessionKeys);
        // and the restored session is exportable with its bindings
        const again = await mk(creatorKey).restoreSession({ session: restored.exportSession() });
        again.verifyDeliveryBindings(sessionKeys);
      });

      it('should still report missing trust if only some recipient keys are supplied', async function() {
        const restored = await mk(creatorKey).restoreSession({
          session: unwrap(creator.exportSession(), creatorKey),
          trusted: { recipientKeys: [{ partyId: 1, partyPubKey: pubKeyOf(keyA) }] }
        });
        should.throw(() => restored.verifyDeliveryBindings(sessionKeys), /Missing trusted public key for party 2/);
      });

      it('should not trust supplied recipient keys the session disagrees with', async function() {
        const restored = await mk(creatorKey).restoreSession({
          session: unwrap(creator.exportSession(), creatorKey),
          trusted: { recipientKeys: [{ partyId: 1, partyPubKey: pubKeyOf(otherKey) }, { partyId: 2, partyPubKey: pubKeyOf(keyB) }] }
        });
        should.throw(() => restored.verifyDeliveryBindings(sessionKeys), /party 1 does not match/);
      });

      it(happyPath('should work for the recipient once the original join code is supplied'), async function() {
        const restored = await mk(keyA).restoreSession({
          session: unwrap(inviteeA.exportSession(), keyA),
          trusted: { joinCode: { code: codeA } }
        });
        restored.verifyDeliveryBindings(sessionKeys);
      });

      it('should work for the recipient with a noKey join code and the expected creator key', async function() {
        const code = await creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keyA), opts: { noKey: true } });
        const restored = await mk(keyA).restoreSession({
          session: unwrap(inviteeA.exportSession(), keyA),
          trusted: { joinCode: { code, opts: { noKey: true }, creatorPubKey: creator.getAuthPublicKey() } }
        });
        restored.verifyDeliveryBindings(sessionKeys);
        await assert.rejects(
          mk(keyA).restoreSession({
            session: unwrap(inviteeA.exportSession(), keyA),
            trusted: { joinCode: { code, opts: { noKey: true } } }
          }),
          { message: /creatorPubKey is required/ }
        );
      });

      it('should reject a join code for another party, or a different session', async function() {
        const otherCreator = mk(otherKey);
        await otherCreator.newKey({ m: 2, n: 3 });
        const foreign = await otherCreator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keyA) });
        const legacy = unwrap(inviteeA.exportSession(), keyA);
        for (const code of [codeB, foreign]) {
          await assert.rejects(
            mk(keyA).restoreSession({ session: legacy, trusted: { joinCode: { code } } }),
            { message: /Invalid checksum|does not match the session being restored/ }
          );
        }
        otherCreator.unsubscribe();
      });

      it('should reject recipient keys together with a join code', async function() {
        const trusted = { recipientKeys: [{ partyId: 1, partyPubKey: pubKeyOf(keyA) }], joinCode: { code: codeA } };
        for (const [key, exported] of [[creatorKey, creator.exportSession()], [keyA, inviteeA.exportSession()]]) {
          await assert.rejects(
            mk(key).restoreSession({ session: exported, trusted: trusted as any }),
            { message: /can only be supplied when restoring (the creator|a recipient)'s session/ }
          );
        }
      });

      it('should reject trusted inputs for the wrong role', async function() {
        const creatorLegacy = unwrap(creator.exportSession(), creatorKey);
        const inviteeLegacy = unwrap(inviteeA.exportSession(), keyA);
        await assert.rejects(
          mk(creatorKey).restoreSession({ session: creatorLegacy, trusted: { joinCode: { code: codeA } } }),
          { message: /recipient's session/ }
        );
        await assert.rejects(
          mk(keyA).restoreSession({ session: inviteeLegacy, trusted: { recipientKeys: [{ partyId: 1, partyPubKey: pubKeyOf(keyA) }] } }),
          { message: /creator's session/ }
        );
      });
    });

    describe('trusted inputs with a retained export', function() {
      it('should accept inputs that agree with the retained keys', async function() {
        const restored = await mk(creatorKey).restoreSession({
          session: creator.exportSession(),
          trusted: { recipientKeys: [{ partyId: 1, partyPubKey: pubKeyOf(keyA) }] }
        });
        restored.verifyDeliveryBindings(sessionKeys);
        const restoredA = await mk(keyA).restoreSession({ session: inviteeA.exportSession(), trusted: { joinCode: { code: codeA } } });
        restoredA.verifyDeliveryBindings(sessionKeys);
      });

      it('should reject inputs that contradict the retained keys instead of replacing them', async function() {
        await assert.rejects(
          mk(creatorKey).restoreSession({
            session: creator.exportSession(),
            trusted: { recipientKeys: [{ partyId: 1, partyPubKey: pubKeyOf(otherKey) }] }
          }),
          { message: /party 1 does not match the retained key/ }
        );

        // A code from a different creator key for this same session. The impostor can't register with BWS,
        // so build the invitation directly, encoded the way createJoinCode() does.
        const forged = ECIES.encrypt({
          message: [creator.id, 1, chain, network, 2, 3, ''].join(':'),
          publicKey: pubKeyOf(keyA),
          privateKey: otherKey.createCredentials(null, { chain, network, n: 1, account: 0 }).requestPrivKey
        }).toString('hex');
        await assert.rejects(
          mk(keyA).restoreSession({ session: inviteeA.exportSession(), trusted: { joinCode: { code: forged } } }),
          { message: /creator key does not match the retained key/ }
        );
      });
    });
  });

  describe('Creator wallet enrollment and delivery publication', function() {
    // Each test runs a real DKG with 10 ms polling, which is slow when the machine is busy
    this.timeout(30000);

    const mk = (key) => new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
    const credsOf = (key) => key.createCredentials(null, { network, n: 1, account: 0 });
    const pubKeyOf = (key) => credsOf(key).requestPubKey;
    /** Whether a request is the creator's own, as opposed to another party's in the same test */
    const isCreatorRequest = (r: Request) => (r.credentials as any)?.requestPubKey === pubKeyOf(keys[0]);
    const nextEvent = (emitter: TssKeyGen, event: string) => new Promise<any>(r => emitter.once(event, r));
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    let keys;
    let tss: TssKeyGen[];
    let urls: Array<{ method: string; url: string; body?: any }>;

    /** Join every party to one session, then run the DKG to completion. Only the creator's subscription (if any) goes on to the wallet. */
    const runCeremony = async (parties: number, creatorSubscribe?: { walletName: string; copayerName: string }) => {
      keys = Array.from({ length: parties }, () => new Key({ seedType: 'new' }));
      tss = keys.map(mk);
      await tss[0].newKey({ m: 2, n: parties });
      for (let partyId = 1; partyId < parties; partyId++) {
        const code = await tss[0].createJoinCode({ partyId, partyPubKey: pubKeyOf(keys[partyId]) });
        await tss[partyId].joinKey({ code });
      }
      const done = tss.map((t, i) => nextEvent(t, i === 0 && creatorSubscribe ? 'wallet' : 'complete'));
      for (const [i, t] of tss.entries()) {
        t.on('error', () => {});
        t.subscribe({ timeout: 10, ...(i === 0 ? creatorSubscribe : {}) });
      }
      await Promise.all(done);
    };

    /** Decrypt the delivery BWS holds for a recipient, as the recipient would */
    const decryptFor = async (partyId: number) => {
      const session = await storage.fetchTssKeyGenSession({ id: tss[0].id });
      const record = session.bwsJoinDelivery.records.find(r => r.partyId === partyId);
      return decryptJoinDelivery({
        delivery: record,
        recipientPrivKey: credsOf(keys[partyId]).requestPrivKey,
        creatorPubKey: tss[0].getAuthPublicKey(),
        expected: {
          sessionId: tss[0].id,
          partyId,
          requestPubKey: pubKeyOf(keys[partyId]),
          chain,
          network,
          m: 2,
          n: tss.length,
          commonKeyChain: tss[partyId].getTssKey().keychain.commonKeyChain
        }
      });
    };

    beforeEach(function() {
      urls = [];
      // Record every request a TSS instance makes. The real request still goes through unless a test replaces it.
      const origGet = Request.prototype.get;
      const origPost = Request.prototype.post;
      sandbox.stub(Request.prototype, 'get').callsFake(function(this: Request, url: string, ...rest) {
        urls.push({ method: 'get', url });
        return origGet.call(this, url, ...rest);
      });
      sandbox.stub(Request.prototype, 'post').callsFake(function(this: Request, url: string, body?: any, ...rest) {
        urls.push({ method: 'post', url, body });
        return origPost.call(this, url, body, ...rest);
      });
    });

    afterEach(function() {
      for (const t of tss || []) {
        t.unsubscribe();
      }
      tss = [];
    });

    const deliveryPosts = () => urls.filter(u => u.method === 'post' && u.url.endsWith('/join-delivery'));
    const createCalls = () => (Client.prototype.createWallet as sinon.SinonSpy);

    for (const parties of [2, 3]) {
      describe(`${parties === 2 ? '2-of-2' : '2-of-3'} ceremony`, function() {
        it(happyPath('should create one wallet and publish an encrypted record to each recipient'), async function() {
          sandbox.spy(Client.prototype, 'createWallet');
          await runCeremony(parties, { walletName: 'wallet', copayerName: 'creator' });

          createCalls().callCount.should.equal(1);
          const { secret } = await createCalls().returnValues[0];
          const walletPrivKey = Client.parseSecret(secret).walletPrivKey.toWIF();

          // Each recipient recovers the original secret, and only with its own key
          for (let partyId = 1; partyId < parties; partyId++) {
            (await decryptFor(partyId)).should.equal(secret);
          }
          const session = await storage.fetchTssKeyGenSession({ id: tss[0].id });
          session.bwsJoinDelivery.records.map(r => r.partyId).should.deep.equal(Array.from({ length: parties - 1 }, (_, i) => i + 1));

          // Neither what the creator sent nor what BWS stored holds the secret or the wallet key
          deliveryPosts().length.should.equal(1);
          const sent = JSON.stringify(deliveryPosts()[0].body);
          const stored = JSON.stringify(session);
          for (const text of [secret, walletPrivKey]) {
            sent.should.not.include(text);
            stored.should.not.include(text);
          }
          // The plaintext path is never used
          urls.filter(u => u.url.includes('/secret')).should.deep.equal([]);
          should.not.exist(session.bwsJoinSecret);
        });
      });
    }

    it('should check the retained keys, then create the wallet, then publish', async function() {
      sandbox.spy(Client.prototype, 'createWallet');
      await runCeremony(2, { walletName: 'wallet', copayerName: 'creator' });
      const order = urls.filter(u => u.url.endsWith('/0') || u.url.includes('/0?') || u.url.endsWith('/join-delivery')).map(u => u.method + ' ' + (u.url.includes('join-delivery') ? 'delivery' : 'round0'));
      // round 0 is read by the creator's own check as well as the DKG; the delivery comes last
      order[order.length - 1].should.equal('post delivery');
      order.slice(0, -1).includes('get round0').should.equal(true);
    });

    it('should publish ciphertext that BWS cannot open and that is not reusable by another recipient', async function() {
      await runCeremony(3, { walletName: 'wallet', copayerName: 'creator' });
      const session = await storage.fetchTssKeyGenSession({ id: tss[0].id });
      const [rec1, rec2] = session.bwsJoinDelivery.records;
      rec1.encryptedMessage.should.not.equal(rec2.encryptedMessage);
      // Party 2's key cannot open party 1's record
      should.throw(() => decryptJoinDelivery({
        delivery: rec1,
        recipientPrivKey: credsOf(keys[2]).requestPrivKey,
        creatorPubKey: tss[0].getAuthPublicKey(),
        expected: {
          sessionId: tss[0].id, partyId: 1, requestPubKey: pubKeyOf(keys[1]), chain, network, m: 2, n: 3,
          commonKeyChain: tss[1].getTssKey().keychain.commonKeyChain
        }
      }), /could not be decrypted$/);
    });

    describe('delivery retries', function() {
      for (const afterWrite of [false, true]) {
        it(`should retry publication after a BWS HTTP 500 ${afterWrite ? 'after' : 'before'} storing delivery`, async function() {
          sandbox.spy(Client.prototype, 'createWallet');
          sandbox.spy(Client.prototype, 'joinWallet');
          await runCeremony(2);

          const store = storage.storeTssKeyJoinDelivery.bind(storage);
          let failed = false;
          sandbox.stub(storage, 'storeTssKeyJoinDelivery').callsFake(async function(params) {
            if (!failed) {
              failed = true;
              if (afterWrite) await store(params);
              throw new Error('MongoNetworkError: temporary database connection loss');
            }
            return store(params);
          });

          const errors = [];
          tss[0].on('error', e => errors.push(e));
          tss[1].on('error', () => {});
          const wallets = Promise.all(tss.map(t => nextEvent(t, 'wallet')));
          const stopped = new Promise<never>((_, reject) => {
            tss[0].once('unsubscribe', () => reject(new Error('Creator stopped before retrying publication')));
            tss[1].once('unsubscribe', () => reject(new Error('Recipient stopped before joining')));
          });
          tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
          tss[1].subscribe({ timeout: 10, copayerName: 'recipient' });
          const [created, joined] = await Promise.race([wallets, stopped]);

          failed.should.equal(true);
          errors.filter(e => getRequestErrorStatus(e) === 500).length.should.equal(1);
          createCalls().callCount.should.equal(1);
          (Client.prototype.joinWallet as sinon.SinonSpy).callCount.should.equal(1);
          deliveryPosts().length.should.equal(2);
          joined.id.should.equal(created.id);
          const { secret } = await createCalls().returnValues[0];
          (await decryptFor(1)).should.equal(secret);
        });
      }

      it('should republish the same wallet\'s secret after a lost publication response, without creating another wallet', async function() {
        sandbox.spy(Client.prototype, 'createWallet');
        await runCeremony(2);

        // The first publication reaches BWS, but the creator never sees the response
        let lost = false;
        const post = Request.prototype.post as sinon.SinonStub;
        const real = post.wrappedMethod ?? post;
        post.callsFake(async function(this: Request, url: string, body?: any, ...rest) {
          urls.push({ method: 'post', url, body });
          const res = await real.call(this, url, body, ...rest);
          if (url.endsWith('/join-delivery') && !lost) {
            lost = true;
            throw new Errors.CONNECTION_ERROR();
          }
          return res;
        });

        await assert.rejects(tss[0].createWallet({ walletName: 'wallet', copayerName: 'creator' }), { name: 'bwc.ErrorCONNECTION_ERROR' });
        const wallet = await tss[0].createWallet({ walletName: 'wallet', copayerName: 'creator' });

        createCalls().callCount.should.equal(1);
        const { wallet: created, secret } = await createCalls().returnValues[0];
        wallet.id.should.equal(created.id);
        deliveryPosts().length.should.equal(2);
        // Fresh randomness each time, same secret
        deliveryPosts()[0].body.records[0].encryptedMessage.should.not.equal(deliveryPosts()[1].body.records[0].encryptedMessage);
        (await decryptFor(1)).should.equal(secret);
      });

      it('should retry through the subscription without restarting creation', async function() {
        sandbox.spy(Client.prototype, 'createWallet');
        const post = Request.prototype.post as sinon.SinonStub;
        const realPost = post.wrappedMethod ?? post;
        let failures = 0;
        post.callsFake(async function(this: Request, url: string, body?: any, ...rest) {
          urls.push({ method: 'post', url, body });
          if (url.endsWith('/join-delivery') && failures < 2) {
            failures++;
            throw new Errors.CONNECTION_ERROR();
          }
          return realPost.call(this, url, body, ...rest);
        });

        keys = [new Key({ seedType: 'new' }), new Key({ seedType: 'new' })];
        tss = keys.map(mk);
        await tss[0].newKey({ m: 2, n: 2 });
        const code = await tss[0].createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keys[1]) });
        await tss[1].joinKey({ code });
        const errors = [];
        tss[0].on('error', e => errors.push(e));
        tss[1].on('error', () => {});
        let stored = 0;
        tss[0].on('tsskeystored', () => stored++);
        const done = Promise.all([nextEvent(tss[0], 'wallet'), nextEvent(tss[1], 'complete')]);
        tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
        tss[1].subscribe({ timeout: 10 });
        await done;

        // The wallet phase ran for three ticks. The key is stored at most once (not at all if the other party stored it first)
        stored.should.be.at.most(1);
        errors.length.should.equal(2);
        errors.every(e => e instanceof Errors.CONNECTION_ERROR).should.equal(true);
        createCalls().callCount.should.equal(1);
        deliveryPosts().length.should.equal(3);
        const { secret } = await createCalls().returnValues[0];
        (await decryptFor(1)).should.equal(secret);
      });

      it('should preserve the enrolled recipient after a rejected replacement and retry delivery', async function() {
        sandbox.spy(Client.prototype, 'createWallet');
        await runCeremony(2);
        const post = Request.prototype.post as sinon.SinonStub;
        const realPost = post.wrappedMethod ?? post;
        let failed = false;
        post.callsFake(async function(this: Request, url: string, body?: any, ...rest) {
          urls.push({ method: 'post', url, body });
          if (url.endsWith('/join-delivery') && !failed) {
            failed = true;
            throw new Errors.CONNECTION_ERROR();
          }
          return realPost.call(this, url, body, ...rest);
        });

        await assert.rejects(tss[0].createWallet({ walletName: 'wallet', copayerName: 'creator' }), { name: 'bwc.ErrorCONNECTION_ERROR' });
        // Once party 1 has enrolled, BWS refuses to register another key for it
        const impostor = new Key({ seedType: 'new' });
        await assert.rejects(
          tss[0].createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(impostor) }),
          { message: /^TSS_ROUNDS_ALREADY_STARTED:/ }
        );
        // The server key and the creator's retained key still agree on the original recipient
        const session = await storage.fetchTssKeyGenSession({ id: tss[0].id });
        session.authPublicKeys[1].should.equal(pubKeyOf(keys[1]));
        tss[0].verifyDeliveryBindings([pubKeyOf(keys[0]), session.authPublicKeys[1]]);

        const wallet = await tss[0].createWallet({ walletName: 'wallet', copayerName: 'creator' });
        createCalls().callCount.should.equal(1);
        const { wallet: created, secret } = await createCalls().returnValues[0];
        wallet.id.should.equal(created.id);
        deliveryPosts().length.should.equal(2);
        (await decryptFor(1)).should.equal(secret);
      });

      it('should retry delivery after the DKG without polling rounds', async function() {
        sandbox.spy(Client.prototype, 'createWallet');
        const get = Request.prototype.get as sinon.SinonStub;
        const realGet = get.wrappedMethod ?? get;
        const roundGets = [];
        get.callsFake(async function(this: Request, url: string, ...rest) {
          urls.push({ method: 'get', url });
          if (isCreatorRequest(this) && tss[0].getTssKey() && /\/v1\/tss\/keygen\/[^/]+\/\d+$/.test(url) && !url.endsWith('/0')) {
            roundGets.push(url);
            throw new Errors.NOT_AUTHORIZED();
          }
          return realGet.call(this, url, ...rest);
        });
        const post = Request.prototype.post as sinon.SinonStub;
        const realPost = post.wrappedMethod ?? post;
        let failures = 0;
        post.callsFake(async function(this: Request, url: string, body?: any, ...rest) {
          urls.push({ method: 'post', url, body });
          if (url.endsWith('/join-delivery') && failures < 2) {
            failures++;
            throw new Errors.CONNECTION_ERROR();
          }
          return realPost.call(this, url, body, ...rest);
        });

        keys = [new Key({ seedType: 'new' }), new Key({ seedType: 'new' })];
        tss = keys.map(mk);
        await tss[0].newKey({ m: 2, n: 2 });
        const code = await tss[0].createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keys[1]) });
        await tss[1].joinKey({ code });
        const errors = [];
        tss[0].on('error', e => errors.push(e));
        tss[1].on('error', () => {});
        const done = Promise.all([nextEvent(tss[0], 'wallet'), nextEvent(tss[1], 'complete')]);
        tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
        tss[1].subscribe({ timeout: 10 });
        await done;

        // Rounds are polled only until the DKG completes...
        errors.filter(e => e instanceof Errors.NOT_AUTHORIZED).length.should.equal(0);
        roundGets.length.should.equal(0);
        // ...and the retries that follow do not poll again
        errors.length.should.equal(2);
        createCalls().callCount.should.equal(1);
        deliveryPosts().length.should.equal(3);
      });

      for (const [name, makeError] of [
        ['rejected', () => new Errors.NOT_AUTHORIZED()],
        ['expired', () => new Errors.TSS_SESSION_EXPIRED()]
      ] as const) {
        it(`should stop on a ${name} session once the DKG is complete`, async function() {
          sandbox.spy(Client.prototype, 'createWallet');
          await runCeremony(2);
          const get = Request.prototype.get as sinon.SinonStub;
          const realGet = get.wrappedMethod ?? get;
          get.callsFake(async function(this: Request, url: string, ...rest) {
            urls.push({ method: 'get', url });
            if (/\/v1\/tss\/keygen\/[^/]+\/\d+$/.test(url)) throw makeError();
            return realGet.call(this, url, ...rest);
          });
          const errors = [];
          tss[0].on('error', e => errors.push(e));
          const unsubscribed = nextEvent(tss[0], 'unsubscribe');
          tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
          await unsubscribed;
          await sleep(100);

          errors.length.should.equal(1);
          createCalls().called.should.equal(false);
        });
      }
    });

    describe('stopping', function() {
      /** Wait out several poll intervals, so a subscription that did not stop would run again */
      const settle = () => sleep(100);

      it('should stop on conflicting trusted keys before creating a wallet', async function() {
        sandbox.spy(Client.prototype, 'createWallet');
        await runCeremony(2);
        const errors = [];
        tss[0].on('error', e => errors.push(e));
        // A dishonest BWS reports a different request key for party 1 than the one the creator invited
        const get = Request.prototype.get as sinon.SinonStub;
        const realGet = get.wrappedMethod ?? get;
        get.callsFake(async function(this: Request, url: string, ...rest) {
          urls.push({ method: 'get', url });
          const res = await realGet.call(this, url, ...rest);
          if (!isCreatorRequest(this) || !/\/v1\/tss\/keygen\/[^/?]+\/0(\?|$)/.test(url)) return res;
          const forged = pubKeyOf(new Key({ seedType: 'new' }));
          return {
            ...res,
            body: {
              ...res.body,
              messages: res.body.messages.map(msg => msg.partyId === 1 ? { ...msg, publicKey: forged } : msg)
            }
          };
        });

        await assert.rejects(tss[0].createWallet({ walletName: 'wallet', copayerName: 'creator' }), { message: /party 1 does not match the trusted key/ });
        createCalls().called.should.equal(false);
        deliveryPosts().length.should.equal(0);
        const session = await storage.fetchTssKeyGenSession({ id: tss[0].id });
        should.not.exist(session.bwsJoinDelivery);
      });

      it('should stop the subscription on missing trust and surface the error', async function() {
        sandbox.spy(Client.prototype, 'createWallet');
        keys = [new Key({ seedType: 'new' }), new Key({ seedType: 'new' })];
        tss = keys.map(mk);
        await tss[0].newKey({ m: 2, n: 2 });
        const code = await tss[0].createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keys[1]) });
        await tss[1].joinKey({ code });
        // A legacy export carries no keys, so the restored creator has nothing to deliver to
        const exported = tss[0].exportSession();
        const legacy = (() => {
          const priv = new BitcoreLib.PrivateKey(credsOf(keys[0]).requestPrivKey);
          const wrapper = JSON.parse(TssUtils.decrypt(Buffer.from(exported.slice('tsskeygen.1.'.length), 'base64'), priv.publicKey, priv).toString());
          return wrapper.session as string;
        })();
        tss[0] = await mk(keys[0]).restoreSession({ session: legacy });

        const errors = [];
        tss[0].on('error', e => errors.push(e));
        tss[1].on('error', () => {});
        const unsubscribed = nextEvent(tss[0], 'unsubscribe');
        tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
        tss[1].subscribe({ timeout: 10 });
        await unsubscribed;
        await settle();

        errors.length.should.equal(1);
        errors[0].message.should.match(/Missing trusted public key for party 1/);
        createCalls().called.should.equal(false);
        deliveryPosts().length.should.equal(0);
      });

      it('should not restart an ambiguous wallet creation failure', async function() {
        sandbox.stub(Client.prototype, 'createWallet').rejects(new Errors.CONNECTION_ERROR());
        keys = [new Key({ seedType: 'new' }), new Key({ seedType: 'new' })];
        tss = keys.map(mk);
        await tss[0].newKey({ m: 2, n: 2 });
        const code = await tss[0].createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keys[1]) });
        await tss[1].joinKey({ code });
        const errors = [];
        tss[0].on('error', e => errors.push(e));
        tss[1].on('error', () => {});
        const unsubscribed = nextEvent(tss[0], 'unsubscribe');
        tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
        tss[1].subscribe({ timeout: 10 });
        await unsubscribed;
        await settle();

        errors.length.should.equal(1);
        errors[0].should.be.instanceOf(Errors.CONNECTION_ERROR);
        createCalls().callCount.should.equal(1);
        deliveryPosts().length.should.equal(0);
      });

      for (const [name, arrange, message] of [
        ['returns nothing', () => { sandbox.stub(Client.prototype, 'createWallet').resolves(undefined); }, /returned no wallet/],
        ['returns no wallet', () => { sandbox.stub(Client.prototype, 'createWallet').resolves({ secret: 'x' } as any); }, /returned no wallet/],
        ['succeeds but its result cannot be recorded', () => {
          sandbox.spy(Client.prototype, 'createWallet');
          // The first call is the client's own, during creation. The second records the result for this instance.
          const addWalletInfo = RealCredentials.prototype.addWalletInfo;
          let calls = 0;
          sandbox.stub(RealCredentials.prototype, 'addWalletInfo').callsFake(function(this: any, ...args: any[]) {
            if (++calls === 2) throw new Error('wallet info rejected');
            return addWalletInfo.apply(this, args);
          });
        }, /wallet info rejected/]
      ] as const) {
        it(`should not create another wallet when creation ${name}`, async function() {
          arrange();
          keys = [new Key({ seedType: 'new' }), new Key({ seedType: 'new' })];
          tss = keys.map(mk);
          await tss[0].newKey({ m: 2, n: 2 });
          const code = await tss[0].createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keys[1]) });
          await tss[1].joinKey({ code });
          const errors = [];
          tss[0].on('error', e => errors.push(e));
          tss[1].on('error', () => {});
          const unsubscribed = nextEvent(tss[0], 'unsubscribe');
          tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
          tss[1].subscribe({ timeout: 10 });
          await unsubscribed;
          await settle();

          errors.length.should.equal(1);
          errors[0].message.should.match(message);
          createCalls().callCount.should.equal(1);
          deliveryPosts().length.should.equal(0);
        });
      }

      it('should stop on a delivery rejection without falling back to the plaintext path', async function() {
        sandbox.spy(Client.prototype, 'createWallet');
        const post = Request.prototype.post as sinon.SinonStub;
        const realPost = post.wrappedMethod ?? post;
        // A server without the delivery endpoint
        post.callsFake(async function(this: Request, url: string, body?: any, ...rest) {
          urls.push({ method: 'post', url, body });
          if (url.endsWith('/join-delivery')) throw new Errors.NOT_FOUND();
          return realPost.call(this, url, body, ...rest);
        });
        keys = [new Key({ seedType: 'new' }), new Key({ seedType: 'new' })];
        tss = keys.map(mk);
        await tss[0].newKey({ m: 2, n: 2 });
        const code = await tss[0].createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(keys[1]) });
        await tss[1].joinKey({ code });
        const errors = [];
        tss[0].on('error', e => errors.push(e));
        tss[1].on('error', () => {});
        const unsubscribed = nextEvent(tss[0], 'unsubscribe');
        tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
        tss[1].subscribe({ timeout: 10 });
        await unsubscribed;
        await settle();

        errors.length.should.equal(1);
        errors[0].should.be.instanceOf(Errors.NOT_FOUND);
        createCalls().callCount.should.equal(1);
        deliveryPosts().length.should.equal(1);
        urls.filter(u => u.url.includes('/secret')).should.deep.equal([]);
      });

      it('should only let the session creator create the wallet', async function() {
        sandbox.spy(Client.prototype, 'createWallet');
        await runCeremony(2);
        await assert.rejects(tss[1].createWallet({ walletName: 'wallet', copayerName: 'party1' }), { message: /Only the session creator/ });
        createCalls().called.should.equal(false);
      });

      it('should not accept a wallet secret that disagrees with the ceremony', async function() {
        const stub = sandbox.stub(Client.prototype, 'createWallet').callsFake(async function(this: any) {
          return { wallet: { id: 'x', addressType: 'P2PKH' }, secret: Client._buildSecret('2b8d1f0e-6c3a-4d9b-8a7e-5f4c3b2a1d0e', new BitcoreLib.PrivateKey(), 'btc', network) };
        });
        await runCeremony(2);
        await assert.rejects(tss[0].createWallet({ walletName: 'wallet', copayerName: 'creator' }), { message: /secret coin does not match/ });
        deliveryPosts().length.should.equal(0);
        stub.callCount.should.equal(1);
      });
    });
  });

  describe('Recipient delivery polling and enrollment', function() {
    this.timeout(30000);

    const mk = (key) => new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
    const credsOf = (key) => key.createCredentials(null, { network, n: 1, account: 0 });
    const pubKeyOf = (key) => credsOf(key).requestPubKey;
    const nextEvent = (emitter: TssKeyGen, event: string) => new Promise<any>(r => emitter.once(event, r));
    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
    const isDeliveryGet = (url: string) => url.endsWith('/join-delivery');

    let keys;
    let tss: TssKeyGen[];
    let urls: Array<{ method: string; url: string; body?: any }>;
    let errors: Array<Array<any>>;

    const createCalls = () => (Client.prototype.createWallet as sinon.SinonSpy);
    const joinCalls = () => (Client.prototype.joinWallet as sinon.SinonSpy);

    /** Create the session and enroll every party's DKG, without starting any subscription */
    const setup = async (parties: number) => {
      keys = Array.from({ length: parties }, () => new Key({ seedType: 'new' }));
      tss = keys.map(mk);
      errors = tss.map(() => []);
      await tss[0].newKey({ m: 2, n: parties });
      for (let partyId = 1; partyId < parties; partyId++) {
        const code = await tss[0].createJoinCode({ partyId, partyPubKey: pubKeyOf(keys[partyId]) });
        await tss[partyId].joinKey({ code });
      }
      for (const [i, t] of tss.entries()) {
        t.on('error', e => errors[i].push(e));
      }
    };

    /** Start the subscriptions that create (party 0) or join (everyone else) the wallet */
    const subscribe = (opts: { creator?: boolean; recipients?: Array<number> } = {}) => {
      const { creator = true, recipients = tss.map((_, i) => i).slice(1) } = opts;
      if (creator) {
        tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
      }
      for (const partyId of recipients) {
        tss[partyId].subscribe({ timeout: 10, copayerName: 'party' + partyId });
      }
    };

    /** The delivery BWS served to a recipient, replaced for that recipient's delivery GETs only */
    const serveDelivery = (replace: (served: any, partyId: number) => any) => {
      const get = Request.prototype.get as sinon.SinonStub;
      const realGet = get.wrappedMethod ?? get;
      get.callsFake(async function(this: Request, url: string, ...rest) {
        urls.push({ method: 'get', url });
        const res = await realGet.call(this, url, ...rest);
        if (!isDeliveryGet(url)) return res;
        const partyId = keys.findIndex(k => pubKeyOf(k) === (this.credentials as any)?.requestPubKey);
        return { ...res, body: replace(res.body, partyId) };
      });
    };

    beforeEach(function() {
      urls = [];
      const origGet = Request.prototype.get;
      const origPost = Request.prototype.post;
      sandbox.stub(Request.prototype, 'get').callsFake(function(this: Request, url: string, ...rest) {
        urls.push({ method: 'get', url });
        return origGet.call(this, url, ...rest);
      });
      sandbox.stub(Request.prototype, 'post').callsFake(function(this: Request, url: string, body?: any, ...rest) {
        urls.push({ method: 'post', url, body });
        return origPost.call(this, url, body, ...rest);
      });
      sandbox.spy(Client.prototype, 'createWallet');
      sandbox.spy(Client.prototype, 'joinWallet');
    });

    afterEach(function() {
      for (const t of tss || []) {
        t.unsubscribe();
      }
      tss = [];
    });

    for (const parties of [2, 3]) {
      it(happyPath(`should join every recipient to the creator's wallet in a ${parties === 2 ? '2-of-2' : '2-of-3'} ceremony`), async function() {
        await setup(parties);
        const wallets = tss.map(t => nextEvent(t, 'wallet'));
        subscribe();
        const joined = await Promise.all(wallets);

        // One wallet, with everyone in it, joined with the secret the creator created
        createCalls().callCount.should.equal(1);
        const { wallet, secret } = await createCalls().returnValues[0];
        joined.every(w => w.id === wallet.id).should.equal(true);
        joinCalls().callCount.should.equal(parties - 1);
        joinCalls().args.every(args => args[0] === secret).should.equal(true);
        const stored = await new Promise<any>((resolve, reject) => {
          storage.fetchWallet(wallet.id, (err, w) => err ? reject(err) : resolve(w));
        });
        stored.copayers.length.should.equal(parties);
        for (const partyErrors of errors) {
          partyErrors.should.deep.equal([]);
        }

        // Only the encrypted route was used
        urls.filter(u => u.url.includes('/secret')).should.deep.equal([]);
        // Each recipient asked for its own delivery, and nobody was told anything else
        urls.filter(u => isDeliveryGet(u.url)).length.should.be.at.least(parties - 1);
      });
    }

    it('should keep polling while the delivery is pending, then join, without processing rounds again', async function() {
      const exportSession = sandbox.spy(TssKeyGen.prototype, 'exportSession');
      const recipientExports = () => exportSession.thisValues.filter(t => t === tss[1]).length;
      await setup(2);
      const keyReady = nextEvent(tss[1], 'tsskey');
      subscribe({ creator: false });
      // The creator finishes the DKG but does not create the wallet yet
      tss[0].subscribe({ timeout: 10 });
      await keyReady;
      const exportsAtCompletion = recipientExports();

      await sleep(300);
      const polls = urls.filter(u => isDeliveryGet(u.url)).length;
      polls.should.be.above(2);
      joinCalls().called.should.equal(false);
      // Pending is not an error, and polling after the DKG neither exports a session nor asks for rounds
      errors[1].should.deep.equal([]);
      recipientExports().should.equal(exportsAtCompletion);

      const wallet = nextEvent(tss[1], 'wallet');
      await tss[0].createWallet({ walletName: 'wallet', copayerName: 'creator' });
      const { secret } = await createCalls().returnValues[0];
      (await wallet).should.have.property('id');
      joinCalls().callCount.should.equal(1);
      joinCalls().args[0][0].should.equal(secret);
    });

    describe('recoverable failures', function() {
      it('should retry the delivery GET after a BWS HTTP 500 and join the existing wallet', async function() {
        await setup(2);
        const getDelivery = BwsTssKeyGen.getJoinDelivery.bind(BwsTssKeyGen);
        let failed = false;
        sandbox.stub(BwsTssKeyGen, 'getJoinDelivery').callsFake(async function(params) {
          if (!failed) {
            failed = true;
            throw new Error('MongoNetworkError: temporary database connection loss');
          }
          return getDelivery(params);
        });
        const wallets = Promise.all(tss.map(t => nextEvent(t, 'wallet')));
        const stopped = new Promise<never>((_, reject) => {
          tss[1].once('unsubscribe', () => reject(new Error('Recipient stopped before retrying delivery')));
        });
        subscribe();
        const [created, joined] = await Promise.race([wallets, stopped]);

        failed.should.equal(true);
        errors[1].filter(e => getRequestErrorStatus(e) === 500).length.should.equal(1);
        createCalls().callCount.should.equal(1);
        joinCalls().callCount.should.equal(1);
        joined.id.should.equal(created.id);
      });

      it('should poll again after a transient failure of the delivery GET', async function() {
        await setup(2);
        const get = Request.prototype.get as sinon.SinonStub;
        const realGet = get.wrappedMethod ?? get;
        let failures = 0;
        get.callsFake(async function(this: Request, url: string, ...rest) {
          urls.push({ method: 'get', url });
          if (isDeliveryGet(url) && failures < 2) {
            failures++;
            throw new Errors.CONNECTION_ERROR();
          }
          return realGet.call(this, url, ...rest);
        });
        const wallets = tss.map(t => nextEvent(t, 'wallet'));
        subscribe();
        await Promise.all(wallets);

        failures.should.equal(2);
        errors[1].length.should.equal(2);
        errors[1].every(e => e instanceof Errors.CONNECTION_ERROR).should.equal(true);
        createCalls().callCount.should.equal(1);
        joinCalls().callCount.should.equal(1);
      });
    });

    describe('stopping', function() {
      /** Subscribe the recipient alone and wait for it to stop. The creator is only running if a test started it. */
      const expectStop = async () => {
        const unsubscribed = nextEvent(tss[1], 'unsubscribe');
        subscribe({ creator: false, recipients: [1] });
        await unsubscribed;
        // Several more intervals, so a subscription that did not stop would try again
        await sleep(100);
      };

      const stopsWith = (name: string, arrange: () => void | Promise<void>, message: RegExp) => {
        it(`should stop before joining when ${name}`, async function() {
          await setup(2);
          await arrange();
          await expectStop();

          errors[1].length.should.equal(1);
          errors[1][0].message.should.match(message);
          joinCalls().called.should.equal(false);
          urls.filter(u => u.url.includes('/secret')).should.deep.equal([]);
          // Rejecting a delivery is not a reason to start another enrollment
          createCalls().callCount.should.equal(1);
        });
      };

      /** A delivery for the recipient, as the creator would make it, except for what the test overrides */
      const deliveryFor = async (opts: { context?: object; signer?: any } = {}) => {
        const { secret } = await createCalls().returnValues[0];
        return encryptJoinDelivery({
          context: {
            sessionId: tss[0].id, partyId: 1, requestPubKey: pubKeyOf(keys[1]), chain, network, m: 2, n: 2,
            commonKeyChain: tss[1].getTssKey().keychain.commonKeyChain,
            ...opts.context
          },
          secret,
          creatorPrivKey: credsOf(opts.signer || keys[0]).requestPrivKey
        });
      };

      /** Run the creator all the way, so the recipient has a real delivery to be given. The recipient only completes the DKG. */
      const published = async () => {
        const creatorDone = nextEvent(tss[0], 'wallet');
        const recipientDone = nextEvent(tss[1], 'complete');
        tss[0].subscribe({ timeout: 10, walletName: 'wallet', copayerName: 'creator' });
        tss[1].subscribe({ timeout: 10 });
        await Promise.all([creatorDone, recipientDone]);
        // Completing removed the listeners
        tss[1].on('error', e => errors[1].push(e));
      };

      stopsWith('the signature has been tampered with', async () => {
        await published();
        const flip = (hex: string) => hex.slice(0, -1) + (hex.endsWith('0') ? '1' : '0');
        serveDelivery(served => ({ ...served, signature: flip(served.signature) }));
      }, /signature verification failed$/);

      stopsWith('the ciphertext has been tampered with', async () => {
        await published();
        serveDelivery(served => {
          const bytes = Buffer.from(served.encryptedMessage, 'base64');
          // eslint-disable-next-line no-bitwise
          bytes[bytes.length - 1] ^= 1;
          return { ...served, encryptedMessage: bytes.toString('base64') };
        });
      }, /could not be decrypted$/);

      stopsWith('the delivery is encrypted to someone else', async () => {
        // Correctly signed by the creator, but for a key that is not this recipient's
        await published();
        const forOther = await deliveryFor({ context: { requestPubKey: pubKeyOf(new Key({ seedType: 'new' })) } });
        serveDelivery(() => ({ version: 1, ...forOther }));
      }, /could not be decrypted$/);

      stopsWith('the delivery is for another ceremony', async () => {
        await published();
        const wrong = await deliveryFor({ context: { commonKeyChain: 'a-different-common-key-chain' } });
        serveDelivery(() => ({ version: 1, ...wrong }));
      }, /commonKeyChain does not match/);

      stopsWith('the delivery is for another session', async () => {
        await published();
        const wrong = await deliveryFor({ context: { sessionId: 'another-session' } });
        serveDelivery(() => ({ version: 1, ...wrong }));
      }, /sessionId does not match/);

      stopsWith('the creator\'s key is not the one the recipient trusts', async () => {
        await published();
        // BWS can only substitute what it serves. A delivery from some other key does not verify against the trusted one.
        const forged = await deliveryFor({ signer: new Key({ seedType: 'new' }) });
        serveDelivery(() => ({ version: 1, ...forged }));
      }, /could not be decrypted$/);

      stopsWith('the delivery format is not supported', async () => {
        await published();
        serveDelivery(served => ({ ...served, version: 2 }));
      }, /Unsupported join delivery version/);

      stopsWith('the server does not have the delivery route', async () => {
        await published();
        const get = Request.prototype.get as sinon.SinonStub;
        const realGet = get.wrappedMethod ?? get;
        get.callsFake(async function(this: Request, url: string, ...rest) {
          urls.push({ method: 'get', url });
          if (isDeliveryGet(url)) throw new Errors.NOT_FOUND();
          return realGet.call(this, url, ...rest);
        });
      }, /not found/i);

      it('should stop before asking for a delivery when the creator\'s key is not trusted', async function() {
        await setup(2);
        // A legacy export carries no keys, and the recipient has nothing but BWS to trust
        const priv = new BitcoreLib.PrivateKey(credsOf(keys[1]).requestPrivKey);
        const exported = tss[1].exportSession().slice('tsskeygen.1.'.length);
        const wrapper = JSON.parse(TssUtils.decrypt(Buffer.from(exported, 'base64'), priv.publicKey, priv).toString());
        tss[1] = await mk(keys[1]).restoreSession({ session: wrapper.session });
        tss[1].on('error', e => errors[1].push(e));
        // The creator takes part in the DKG, but does not create the wallet
        tss[0].subscribe({ timeout: 10 });
        await expectStop();

        errors[1].length.should.equal(1);
        errors[1][0].message.should.match(/Missing trusted creator public key/);
        urls.filter(u => isDeliveryGet(u.url)).should.deep.equal([]);
        joinCalls().called.should.equal(false);
      });

      for (const [name, makeError] of [
        ['rejected', () => new Errors.NOT_AUTHORIZED()],
        ['expired', () => new Errors.TSS_SESSION_EXPIRED()]
      ] as const) {
        it(`should stop on ${name === 'expired' ? 'an' : 'a'} ${name} session once the DKG is complete`, async function() {
          await setup(2);
          const keyReady = nextEvent(tss[1], 'tsskey');
          tss[0].subscribe({ timeout: 10 });
          tss[1].subscribe({ timeout: 10, copayerName: 'party1' });
          await keyReady;
          const get = Request.prototype.get as sinon.SinonStub;
          const realGet = get.wrappedMethod ?? get;
          get.callsFake(async function(this: Request, url: string, ...rest) {
            urls.push({ method: 'get', url });
            if (isDeliveryGet(url)) throw makeError();
            return realGet.call(this, url, ...rest);
          });
          await nextEvent(tss[1], 'unsubscribe');
          await sleep(100);

          errors[1].length.should.equal(1);
          joinCalls().called.should.equal(false);
          createCalls().called.should.equal(false);
        });
      }

      it('should not retry an ambiguous join failure as another enrollment', async function() {
        await setup(2);
        (Client.prototype.joinWallet as sinon.SinonSpy).restore();
        sandbox.stub(Client.prototype, 'joinWallet').rejects(new Errors.CONNECTION_ERROR());
        const unsubscribed = nextEvent(tss[1], 'unsubscribe');
        subscribe();
        await unsubscribed;
        await sleep(100);

        errors[1].length.should.equal(1);
        errors[1][0].should.be.instanceOf(Errors.CONNECTION_ERROR);
        joinCalls().callCount.should.equal(1);
        createCalls().callCount.should.equal(1);
      });
    });

    it('should not put the decrypted secret in an error or an event', async function() {
      await setup(2);
      const events: Array<any> = [];
      for (const event of ['roundready', 'roundprocessed', 'roundsubmitted', 'tsskeystored', 'wallet', 'complete', 'error']) {
        tss[1].on(event, (...args) => events.push(args));
      }
      const wallet = nextEvent(tss[1], 'wallet');
      subscribe();
      await wallet;
      const { secret } = await createCalls().returnValues[0];
      const { walletPrivKey } = Client.parseSecret(secret);
      for (const text of [secret, walletPrivKey.toWIF()]) {
        JSON.stringify(events).should.not.include(text);
      }
    });
  });
});
