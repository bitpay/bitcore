'use strict';

import sinon from 'sinon';
import chai from 'chai';
import BWS from 'bitcore-wallet-service';
import request from 'supertest';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { ECIES } from 'bitcore-tss';
import { Request } from '../src/lib/request';
import { BitcoreLib, Deriver } from 'crypto-wallet-core';
import { TssKeyGen, TssKey } from '../src/lib/tsskey';
import { TssSign } from '../src/lib/tsssign';
import log from '../src/lib/log';
import Client from '../src';
import {
  helpers,
  blockchainExplorerMock
} from './helpers';

const should = chai.should();
const datadir = path.join(__dirname, 'data');
const Key = Client.Key;

describe('TSS', function() {
  this.timeout(10000); 

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
    let tss0;
    let tss1;
    let tss2;
    let joinCode1;
    let joinCode2;

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

    it(happyPath('should create a join code'), function() {
      const code1 = tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
      });
      should.exist(code1);
      code1.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code1).should.equal(true);
      joinCode1 = code1;

      const code2 = tss0.createJoinCode({
        partyId: 2,
        partyPubKey: party2Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
      });
      should.exist(code2);
      code2.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code2).should.equal(true);
      joinCode2 = code2;
    });

    it('should not produce a deterministic join code', function() {
      const code = tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey
      });
      should.exist(code);
      code.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code).should.equal(true);
      code.should.not.equal(joinCode1);
    });

    it('should encode the join code per the encoding option', function() {
      const code = tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey,
        opts: { encoding: 'base64'}
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
      }});
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
      sandbox.spy(tss0, 'restoreSession');
      sandbox.spy(tss1, 'restoreSession');
      sandbox.spy(tss2, 'restoreSession');
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
      (tss0.restoreSession.callCount + tss1.restoreSession.callCount + tss2.restoreSession.callCount).should.be.gte(1);
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

    it(happyPath('should have stored the encrypted key shares'), async function() {
      const session = await storage.fetchTssKeyGenSession({ id: tss0.id });
      session.keyShares.length.should.equal(n);

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
      should.throw(() => { tss0.exportSession() }, /Cannot export a completed session/);
    });

    it('should cleanly handle a subscription to a finished session', async function() {
      sandbox.spy(tss0, 'emit');
      const complete = new Promise(r => tss0.once('complete', r));
      tss0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss0.subscribe({ timeout: 10, iterHandler: () => tss0.unsubscribe() });
      await complete;
      tss0.emit.args.filter(o => o[0] === 'roundready').length.should.equal(0);
      tss0.emit.args.filter(o => o[0] === 'tsskey').length.should.equal(1);
      tss0.emit.args.filter(o => o[0] === 'complete').length.should.equal(1);
    });

    // Keeping for documentation purposes
    it.skip('SKIP ME - save to data dir', function(){ 
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
        const code1 = tss0.createJoinCode({
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
        const code1 = tss0.createJoinCode({
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
        const code1 = tss0.createJoinCode({
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
        const code1 = tss0.createJoinCode({
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
      for (const tssKey of [party0TssKey, party1TssKey, party2TssKey]) {
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
      emitSpy.callCount.should.equal(3);
      emitSpy.args[0][0].should.equal('roundready');
      emitSpy.args[1][0].should.equal('roundprocessed');
      emitSpy.args[2][0].should.equal('error');
      emitSpy.args[2][1].should.equal(e);
      e.message.should.include('TSS_ROUND_ALREADY_DONE');
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
      should.throw(() => { sig0.exportSession() }, /Cannot export a completed session/);
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
});