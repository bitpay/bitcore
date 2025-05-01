'use strict';

const sinon = require('sinon');
const should = require('chai').should();
const BWS = require('bitcore-wallet-service');
const request = require('supertest');
const { Request } = require('../ts_build/lib/request');
const crypto = require('crypto');
const { BitcoreLib } = require('crypto-wallet-core');
const { TssKeyGen } = require('../ts_build/lib/tsskeygen');
const log = require('../ts_build/lib/log').default;
const Client = require('../ts_build').default;
const {
  helpers,
  blockchainExplorerMock
} = require('./helpers');

const Key = Client.Key;

//
describe('TSS', function() {
  //
  // TODO - remove this
  this.timeout(99999999); 
  //

  let db;
  let storage;
  let dbConnection;
  let app;
  const sandbox = sinon.createSandbox();

  const party0Key = new Key({ seedType: 'new' });
  const party1Key = new Key({ seedType: 'new' });
  const party2Key = new Key({ seedType: 'new' });

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

  it('should make a Tss class', function() {
    const tss = new TssKeyGen({ baseUrl: '/bws/api', key: party0Key, request: request(app) });
    should.exist(tss);
  });

  describe('key', function() {
    const m = 2;
    const n = 3;
    let tss0;
    let tss1;
    let tss2;
    let joinCode1;
    let joinCode2;

    before(function() {
      tss0 = new TssKeyGen({
        baseUrl: '/bws/api',
        request: request(app),
        key: party0Key
      });
    });

    afterEach(function() {
      tss0?.unsubscribe();
      tss1?.unsubscribe();
      tss2?.unsubscribe();
    });

    it('should start a new keygen session', async function() {
      const result = await tss0.newKey({ m, n });
      should.exist(result);
      result.should.equal(tss0);
      tss0.id.should.be.a('string');
      const seed = crypto.createHash('sha256').update(BitcoreLib.HDPrivateKey.fromString(party0Key.get().xPrivKey).toBuffer()).digest();
      tss0.id.should.equal(crypto.createHash('sha256').update(crypto.createHash('sha256').update(seed).digest()).digest('hex'));
      tss0.m.should.equal(m);
      tss0.n.should.equal(n);
      tss0.partyId.should.equal(0);
    });

    it('should create a join code', function() {
      const code1 = tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network: 'livenet', n: 1, account: 0 }).requestPubKey
      });
      should.exist(code1);
      code1.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code1).should.equal(true);
      joinCode1 = code1;

      const code2 = tss0.createJoinCode({
        partyId: 2,
        partyPubKey: party2Key.createCredentials(null, { network: 'livenet', n: 1, account: 0 }).requestPubKey
      });
      should.exist(code2);
      code2.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code2).should.equal(true);
      joinCode2 = code2;
    });

    it('should not produce a deterministic join code', function() {
      const code = tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network: 'livenet', n: 1, account: 0 }).requestPubKey
      });
      should.exist(code);
      code.should.be.a('string');
      BitcoreLib.util.js.isHexaString(code).should.equal(true);
      code.should.not.equal(joinCode1);
    });

    it('should encode the join code per the encoding option', function() {
      const code = tss0.createJoinCode({
        partyId: 1,
        partyPubKey: party1Key.createCredentials(null, { network: 'livenet', n: 1, account: 0 }).requestPubKey,
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

    it('should use the join code to join a keygen session', async function() {
      // party 1
      tss1 = new TssKeyGen({
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

    it('should start round 1 by party1', async function() {
      // I chose to start the round with party 1. In practice, anyone can start the round
      const response = new Promise(r => tss1.once('roundsubmitted', r));
      tss1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss1.subscribe({ timeout: 10, iterHandler: () => tss1.unsubscribe() });
      const submittedRound = await response;
      submittedRound.should.equal(1);
    });

    it('should not allow party1 to go on to the next round', function(done) {
      sandbox.spy(Request.prototype, 'doRequest');
      tss1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss1.subscribe({ timeout: 10, iterHandler: () => {
        tss1.unsubscribe();
        Request.prototype.doRequest.callCount.should.equal(1);
        Request.prototype.doRequest.args[0][0].should.equal('get');
        Request.prototype.doRequest.args[0][1].should.include(`/v1/tss/keygen/${tss1.id}/1?r=`);
        done();
      }});
    });

    it('should continue round 1', async function() {
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
        baseUrl: '/bws/api',
        request: request(app),
        key: party0Key
      }).restoreSession({ session: s0 });

      tss1 = await new TssKeyGen({
        baseUrl: '/bws/api',
        request: request(app),
        key: party1Key
      }).restoreSession({ session: s1 });
      
      tss2 = await new TssKeyGen({
        baseUrl: '/bws/api',
        request: request(app),
        key: party2Key
      }).restoreSession({ session: s2 });
    });

    it('should do round 2 (with API fault tolerance)', async function() {
      // fault tolerance setup
      sandbox.stub(Request.prototype, 'post').throws(new Error('restore me'));
      sandbox.spy(tss0, 'restoreSession');
      sandbox.spy(tss1, 'restoreSession');
      sandbox.spy(tss2, 'restoreSession');
      function restore() { Request.prototype.post.restore?.(); };

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

    it('should do round 3', async function() {
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

    it('should do round 4', async function() {
      const response0 = new Promise(r => tss0.once('roundsubmitted', r));
      const response1 = new Promise(r => tss1.once('roundsubmitted', r));
      const response2 = new Promise(r => tss2.once('roundsubmitted', r));
      const complete = new Promise(r => tss0.once('complete', r));
      tss0.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss1.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss2.on('error', (e) => { should.not.exist(e?.message ?? e); });
      tss0.subscribe({ timeout: 10, iterHandler: () => tss0.unsubscribe() });
      tss1.subscribe({ timeout: 10, iterHandler: () => tss1.unsubscribe() });
      tss2.subscribe({ timeout: 10, iterHandler: () => tss2.unsubscribe() });
      const submitted0Round = await response0;
      submitted0Round.should.equal(4);
      const submitted1Round = await response1;
      submitted1Round.should.equal(4);
      const submitted2Round = await response2;
      submitted2Round.should.equal(4);
      // check that the shared pub key was generated and stored
      await complete;
      const session = await storage.fetchTssKeygen({ id: tss0.id });
      should.exist(session.sharedPublicKey);
    });

    it('should not export a completed session', function() {
      should.throw(() => { tss0.exportSession() }, /Cannot export a completed session/);
    })
  });
});