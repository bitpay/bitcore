'use strict';

/**
 * End-to-end checks of encrypted TSS wallet enrollment, run the way a user's wallet flow runs: real ceremonies through
 * the public TssKeyGen API against BWS's Express app and a real database, wallets saved and reopened the way the CLI
 * does, threshold signing afterwards, and the stored documents inspected directly.
 * The finer-grained delivery behavior (tampering, retries, restore, authorization) is covered in tss.test.ts and
 * BWS's integration tests; this file is about the combined flow and what ends up persisted.
 */

import * as chai from 'chai';
import sinon from 'sinon';
import request from 'supertest';
import BWS from '@bitpay-labs/bitcore-wallet-service';
import { BitcoreLib, Deriver } from '@bitpay-labs/crypto-wallet-core';
import Client from '../src';
import log from '../src/lib/log';
import { Request, isTransientRequestError } from '../src/lib/request';
import { TssKey, TssKeyGen } from '../src/lib/tsskey';
import { TssSign } from '../src/lib/tsssign';
import { blockchainExplorerMock, helpers } from './helpers';

const should = chai.should();
const Key = Client.Key;

describe('TSS join delivery, end to end', function() {
  // Each ceremony runs a real DKG with 10 ms polling, which is slow when the machine is busy
  this.timeout(60000);

  const chain = 'ETH';
  const network = 'livenet';
  const derivationPath = 'm/0/0';
  const sandbox = sinon.createSandbox();

  let db;
  let dbConnection;
  let storage;
  let app;

  before(function(done) {
    helpers.newDb(null, (err, database, connection) => {
      if (err) return done(err);
      dbConnection = connection;
      db = database;
      storage = new BWS.Storage({ db });
      BWS.Storage.createIndexes(db);

      const expressApp = new BWS.ExpressApp();
      expressApp.start(
        {
          ignoreRateLimiter: true,
          storage,
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
    sandbox.restore();
    if (dbConnection) dbConnection.close(done);
    else done();
  });

  // Mongo documents, as stored
  const find = (collection: string, filter: object) => db.collection(collection).find(filter).toArray();
  const findOne = (collection: string, filter: object) => db.collection(collection).findOne(filter);
  const stringify = (doc: unknown) => JSON.stringify(doc);

  const mk = (key) => new TssKeyGen({ chain, network, baseUrl: '/bws/api', request: request(app), key });
  const pubKeyOf = (key) => key.createCredentials(null, { network, n: 1, account: 0 }).requestPubKey;
  const nextEvent = (emitter: TssKeyGen | TssSign, event: string) => new Promise<any>(r => emitter.once(event, r));
  /**
   * Resolves when every emitter has emitted its event, and rejects as soon as any of them emits an error.
   * Transient request failures are not errors here: the subscriptions retry those, and polling this fast through
   * supertest's per-request servers produces the occasional dropped connection.
   */
  const allEvents = (emitters: Array<TssKeyGen | TssSign>, events: Array<string>) => {
    const failed = new Promise<never>((_, reject) => {
      for (const emitter of emitters) {
        emitter.on('error', err => {
          if (!isTransientRequestError(err)) reject(err);
        });
      }
    });
    return Promise.race([Promise.all(emitters.map((e, i) => nextEvent(e, events[i]))), failed]);
  };
  const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
  /** A request URL without the query GET requests carry */
  const path = (url: string) => url.split('?')[0];
  const reviveBuffers = (_key, value) => (value?.type === 'Buffer' && Array.isArray(value.data)) ? Buffer.from(value.data) : value;

  /** Every way a value could show up in a request, response or document if it were sent or stored unencrypted */
  const encodings = (value: string) => [
    value,
    Buffer.from(value).toString('base64'),
    Buffer.from(value).toString('hex')
  ];

  interface Traffic {
    method: string;
    url: string;
    requestPubKey?: string;
    body?: any;
    response?: any;
  }

  interface Ceremony {
    n: number;
    sessionId: string;
    keys: Array<any>;
    tss: Array<TssKeyGen>;
    walletName: string;
    copayerNames: Array<string>;
    /** The ordinary join secret the creator's wallet creation produced */
    secret: string;
    walletPrivKey: { wif: string; hex: string };
    sharedEncryptingKey: string;
    traffic: Array<Traffic>;
  }

  /**
   * Run a whole ceremony: join the parties, run the DKG, create and enroll the wallet.
   * Everyone ends up enrolled, except for recipients in `holdEnrollment`, which only complete the DKG.
   */
  const runCeremony = async (opts: {
    n: number;
    /** The order the recipients join the session in. Default: ascending party ID */
    joinOrder?: Array<number>;
    /** Session password, passed to recipients through the invitation's `extra` */
    password?: string;
    noKey?: boolean;
    holdEnrollment?: Array<number>;
  }): Promise<Ceremony> => {
    const { n, password, noKey, holdEnrollment = [] } = opts;
    const joinOrder = opts.joinOrder ?? Array.from({ length: n - 1 }, (_, i) => i + 1);

    const traffic: Array<Traffic> = [];
    const tss: Array<TssKeyGen> = [];
    const doRequest = Request.prototype.doRequest;
    const requestStub = sandbox.stub(Request.prototype, 'doRequest').callsFake(async function(this: Request, method: string, url: string, args: any, ...rest) {
      const entry: Traffic = {
        method,
        url,
        requestPubKey: this.credentials?.requestPubKey,
        body: method === 'post' || method === 'put' ? args : undefined
      };
      traffic.push(entry);
      const res = await doRequest.call(this, method, url, args, ...rest);
      entry.response = res?.body;
      return res;
    });
    const createWallet = sandbox.spy(Client.prototype, 'createWallet');

    try {
      const keys = Array.from({ length: n }, () => new Key({ seedType: 'new' }));
      tss.push(...keys.map(mk));
      await tss[0].newKey({ m: 2, n, password });
      const invitationOpts = noKey ? { noKey: true } : undefined;
      for (const partyId of joinOrder) {
        const code = tss[0].createJoinCode({ partyId, partyPubKey: pubKeyOf(keys[partyId]), extra: password, opts: invitationOpts });
        await tss[partyId].joinKey({
          code,
          opts: invitationOpts,
          creatorPubKey: noKey ? tss[0].getAuthPublicKey() : undefined
        });
      }

      const walletName = 'Funtest Wallet';
      const copayerNames = keys.map((_, i) => i === 0 ? 'Carol Creator' : `Recipient Number${i}`);
      const done = allEvents(tss, tss.map((_, i) => i === 0 || !holdEnrollment.includes(i) ? 'wallet' : 'complete'));
      for (const [i, t] of tss.entries()) {
        t.subscribe({
          timeout: 10,
          ...(i === 0 && { walletName }),
          ...(!holdEnrollment.includes(i) && { copayerName: copayerNames[i] })
        });
      }
      await done;

      createWallet.callCount.should.equal(1);
      const { secret } = await createWallet.returnValues[0];
      const walletPrivKey = Client.parseSecret(secret).walletPrivKey;
      return {
        n,
        sessionId: tss[0].id,
        keys,
        tss,
        walletName,
        copayerNames,
        secret,
        walletPrivKey: { wif: walletPrivKey.toWIF(), hex: walletPrivKey.toString() },
        sharedEncryptingKey: createWallet.thisValues[0].credentials.sharedEncryptingKey,
        traffic
      };
    } finally {
      // Keep error listeners for requests that were already in flight when another participant failed.
      for (const t of tss) {
        t.unsubscribe({ clearEvents: false });
      }
      requestStub.restore();
      createWallet.restore();
    }
  };

  const stopAll = (c?: Ceremony) => {
    for (const t of c?.tss ?? []) {
      t.unsubscribe();
    }
  };

  /** The wallet the ceremony created, as stored, along with its copayer lookups */
  const storedWallet = async (c: Ceremony) => {
    const wallets = await find('wallets', { tssKeyId: c.sessionId });
    const lookups = wallets.length ? await find('copayers_lookup', { walletId: wallets[0].id }) : [];
    return { wallets, wallet: wallets[0], lookups };
  };

  /** What a wallet file holds after the CLI saves it: the TSS key and the credentials of the opened wallet */
  const saveWallet = async (c: Ceremony, partyId: number) => {
    const tssKey = c.tss[partyId].getTssKey();
    const credentials = tssKey.createCredentials(null, { chain, network, account: 0 });
    const client = helpers.newClient(app);
    client.fromObj(credentials.toObj());
    await client.openWallet();
    return JSON.stringify({ key: tssKey.toObj(), credentials: client.toObj() });
  };

  /** Load a saved wallet into fresh objects, as a new process would */
  const reopenWallet = async (saved: string) => {
    const { key, credentials } = JSON.parse(saved, reviveBuffers);
    const client = helpers.newClient(app);
    client.fromObj(credentials);
    await client.openWallet();
    return { client, tssKey: new TssKey(key) };
  };

  let signCount = 0;

  /** Threshold-sign a fresh message with the given wallets, and check the result against the wallet's public key */
  const signWith = async (signers: Array<{ client: any; tssKey: TssKey }>) => {
    const message = `functional signing ${Date.now()}-${signCount++}`;
    const messageHash = BitcoreLib.crypto.Hash.sha256(Buffer.from(message));
    const signs = signers.map(({ client, tssKey }) => new TssSign({
      baseUrl: '/bws/api',
      request: request(app),
      credentials: client.credentials,
      tssKey
    }));
    try {
      for (const s of signs) {
        await s.start({ messageHash, derivationPath });
      }
      const completed = allEvents(signs, signs.map(() => 'complete'));
      for (const s of signs) {
        s.subscribe({ timeout: 10 });
      }
      await completed;

      const signature = signs[0].getSignature();
      const expectedPubKey = BitcoreLib.HDPublicKey(signers[0].tssKey.getXPubKey()).deriveChild(derivationPath).publicKey;
      signature.pubKey.should.equal(expectedPubKey.toString('hex'));
      // r and s are 0x-prefixed hex
      const parsed = new BitcoreLib.crypto.Signature(
        BitcoreLib.crypto.BN.fromString(signature.r.replace(/^0x/, ''), 16),
        BitcoreLib.crypto.BN.fromString(signature.s.replace(/^0x/, ''), 16)
      );
      BitcoreLib.crypto.ECDSA.verify(messageHash, parsed, expectedPubKey).should.equal(true, 'signature does not verify');
      for (const s of signs) {
        s.getSignature().should.deep.equal(signature);
      }
      return { signature, sessionId: signs[0].id };
    } finally {
      for (const s of signs) {
        s.unsubscribe();
      }
    }
  };

  for (const n of [2, 3]) {
    describe(`${n === 2 ? '2-of-2' : '2-of-3'} wallet`, function() {
      let c: Ceremony;
      let saved: Array<string>;

      before(async function() {
        // Recipients join the session in reverse party order
        c = await runCeremony({ n, joinOrder: Array.from({ length: n - 1 }, (_, i) => n - 1 - i) });
        saved = [];
        for (let partyId = 0; partyId < n; partyId++) {
          saved.push(await saveWallet(c, partyId));
        }
      });

      after(function() {
        stopAll(c);
      });

      it('should enroll every participant in one wallet and record it', async function() {
        const session = await findOne('tss_keygen', { id: c.sessionId });
        session.n.should.equal(n);
        session.participants.filter(Boolean).length.should.equal(n);
        session.rounds.length.should.be.greaterThan(0);
        should.exist(session.sharedPublicKey);

        const { wallets, wallet, lookups } = await storedWallet(c);
        wallets.length.should.equal(1);
        wallet.copayers.length.should.equal(n);
        // BWS stores TSS wallets as 1-of-1 whatever the ceremony threshold
        wallet.m.should.equal(1);
        wallet.n.should.equal(1);
        lookups.length.should.equal(n);
        lookups.every(l => l.walletId === wallet.id).should.equal(true);
        new Set(lookups.map(l => l.copayerId)).size.should.equal(n);
        wallet.copayers.map(cp => cp.id).sort().should.deep.equal(lookups.map(l => l.copayerId).sort());
      });

      it('should hold only encrypted records for the non-creators, joined in any order', async function() {
        const session = await findOne('tss_keygen', { id: c.sessionId });
        session.bwsJoinDelivery.version.should.equal(1);
        session.bwsJoinDelivery.records.map(r => r.partyId).sort().should.deep.equal(Array.from({ length: n - 1 }, (_, i) => i + 1));
        for (const record of session.bwsJoinDelivery.records) {
          Object.keys(record).sort().should.deep.equal(['encryptedMessage', 'partyId', 'signature']);
        }
        // May be absent or null in a new session, but never a string
        should.equal(session.bwsJoinSecret ?? null, null);
        (await find('tss_keygen', { bwsJoinSecret: { $type: 'string' } })).length.should.equal(0);
      });

      it('should show readable names to every participant and keep them encrypted at rest', async function() {
        const { wallet } = await storedWallet(c);
        for (const text of [c.walletName, ...c.copayerNames]) {
          stringify(wallet).should.not.include(text);
        }

        const ids = new Set<string>();
        for (let partyId = 0; partyId < n; partyId++) {
          const { client } = await reopenWallet(saved[partyId]);
          const { wallet: status } = await client.getStatus({ includeExtendedInfo: true });
          status.name.should.equal(c.walletName);
          status.copayers.map(cp => cp.name).sort().should.deep.equal([...c.copayerNames].sort());
          ids.add(status.id);
        }
        ids.size.should.equal(1);

        // Every participant derives the same wallet public key, and so the same addresses
        const xpubs = c.tss.map(t => t.getTssKey().getXPubKey());
        new Set(xpubs).size.should.equal(1);
        Deriver.getAddress(chain, network, BitcoreLib.HDPublicKey(xpubs[0]).deriveChild(derivationPath).publicKey)
          .should.be.a('string');
      });

      it('should keep the join secret, wallet key and shared key out of requests and stored documents', async function() {
        const sensitive = [
          ...encodings(c.secret),
          ...encodings(c.walletPrivKey.wif),
          ...encodings(c.walletPrivKey.hex),
          ...encodings(c.sharedEncryptingKey)
        ];

        const requests = stringify(c.traffic);
        const { wallets, lookups } = await storedWallet(c);
        const stored = stringify([
          await findOne('tss_keygen', { id: c.sessionId }),
          wallets,
          lookups
        ]);
        // The scan sees what was sent and stored: the ciphertext is there, and the sensitive values are not
        const record = (await findOne('tss_keygen', { id: c.sessionId })).bwsJoinDelivery.records[0];
        requests.should.include(record.encryptedMessage);
        stored.should.include(record.encryptedMessage);
        for (const value of sensitive) {
          requests.should.not.include(value);
          stored.should.not.include(value);
        }

        // Personal recovery data is still there, and is not readable
        const customData = wallets[0].copayers.map(cp => cp.customData);
        customData.every(Boolean).should.equal(true);
        for (const data of customData) {
          (typeof data).should.equal('string');
          data.should.not.include('walletPrivKey');
        }
      });

      it('should deliver in the documented format, to each recipient its own record, and never use the plaintext route', async function() {
        const posts = c.traffic.filter(t => t.method === 'post' && path(t.url).endsWith('/join-delivery'));
        posts.length.should.equal(1);
        posts[0].body.version.should.equal(1);
        posts[0].body.records.map(r => r.partyId).sort().should.deep.equal(Array.from({ length: n - 1 }, (_, i) => i + 1));
        for (const record of posts[0].body.records) {
          Object.keys(record).sort().should.deep.equal(['encryptedMessage', 'partyId', 'signature']);
        }

        const gets = c.traffic.filter(t => t.method === 'get' && path(t.url).endsWith('/join-delivery') && t.response);
        gets.length.should.be.at.least(n - 1);
        const recipients = new Set<number>();
        for (const get of gets) {
          const partyId = c.keys.findIndex(key => pubKeyOf(key) === get.requestPubKey);
          partyId.should.be.greaterThan(0);
          const record = posts[0].body.records.find(r => r.partyId === partyId);
          should.exist(record);
          get.response.should.deep.equal({
            version: 1,
            encryptedMessage: record.encryptedMessage,
            signature: record.signature
          });
          recipients.add(partyId);
        }
        [...recipients].sort().should.deep.equal(Array.from({ length: n - 1 }, (_, i) => i + 1));

        c.traffic.filter(t => t.url.includes('/secret')).should.deep.equal([]);
      });

      it('should sign with every pair that can, and verify against the wallet key', async function() {
        const pairs = n === 2 ? [[0, 1]] : [[0, 1], [1, 2], [0, 2]];
        for (const pair of pairs) {
          const signers = await Promise.all(pair.map(partyId => reopenWallet(saved[partyId])));
          await signWith(signers);
        }
        const sessions = await find('tss_sign', {});
        sessions.length.should.be.at.least(pairs.length);
        sessions.every(s => s.m === 2).should.equal(true);
      });

      it('should not complete a signature with a single participant', async function() {
        const alone = await reopenWallet(saved[0]);
        const message = `solo ${Date.now()}`;
        const sign = new TssSign({
          baseUrl: '/bws/api',
          request: request(app),
          credentials: alone.client.credentials,
          tssKey: alone.tssKey
        });
        let signed = false;
        let successfulPolls = 0;
        const errors: Array<Error> = [];
        sign.on('signature', () => { signed = true; });
        sign.on('error', err => {
          if (!isTransientRequestError(err)) errors.push(err);
        });
        const get = Request.prototype.get;
        const getStub = sandbox.stub(Request.prototype, 'get').callsFake(function(this: Request, url: string, ...rest) {
          // Return incomplete rounds immediately instead of waiting for BWS's default 20-second long poll.
          if (url.startsWith(`/v1/tss/sign/${sign.id}/`)) {
            url += (url.includes('?') ? '&' : '?') + 'maxWaitTime=0';
          }
          return get.call(this, url, ...rest);
        });
        try {
          await sign.start({ messageHash: BitcoreLib.crypto.Hash.sha256(Buffer.from(message)), derivationPath });
          sign.subscribe({ timeout: 10, iterHandler: () => { successfulPolls++; } });
          await sleep(2000);
          errors.should.deep.equal([]);
          successfulPolls.should.be.at.least(3, 'the lone signer must successfully poll the session');
          signed.should.equal(false);
          should.not.exist(sign.getSignature());
          const session = await findOne('tss_sign', { id: sign.id });
          session.m.should.equal(2);
          session.participants.should.deep.equal([{ partyId: 0, copayerId: alone.client.credentials.copayerId }]);
          should.not.exist(session.signature);
        } finally {
          sign.unsubscribe({ clearEvents: false });
          getStub.restore();
        }
      });

      it('should reopen every saved wallet in fresh objects without creating anything new', async function() {
        const before = {
          session: stringify(await findOne('tss_keygen', { id: c.sessionId })),
          wallet: stringify((await storedWallet(c)).wallet),
          lookups: stringify((await storedWallet(c)).lookups)
        };
        const traffic: Array<string> = [];
        const doRequest = Request.prototype.doRequest;
        sandbox.stub(Request.prototype, 'doRequest').callsFake(function(this: Request, method: string, url: string, ...rest) {
          traffic.push(`${method} ${url}`);
          return doRequest.call(this, method, url, ...rest);
        });
        try {
          for (let partyId = 0; partyId < n; partyId++) {
            const { client } = await reopenWallet(saved[partyId]);
            const { wallet: status } = await client.getStatus({});
            status.name.should.equal(c.walletName);
            status.copayers.find(cp => cp.id === client.credentials.copayerId).name.should.equal(c.copayerNames[partyId]);
          }
        } finally {
          (Request.prototype.doRequest as sinon.SinonStub).restore();
        }

        // Nothing is created, joined or delivered by reopening
        traffic.filter(t => /^(post|put) /.test(t)).should.deep.equal([]);
        traffic.filter(t => t.includes('/secret') || t.includes('join-delivery')).should.deep.equal([]);
        const { wallets, wallet, lookups } = await storedWallet(c);
        wallets.length.should.equal(1);
        stringify(await findOne('tss_keygen', { id: c.sessionId })).should.equal(before.session);
        stringify(wallet).should.equal(before.wallet);
        stringify(lookups).should.equal(before.lookups);
      });

      it('should recover missing metadata keys, reopen the recovered wallets and sign', async function() {
        const before = {
          session: stringify(await findOne('tss_keygen', { id: c.sessionId })),
          wallet: stringify((await storedWallet(c)).wallet)
        };

        const recovered: Array<string> = [];
        // The creator and a recipient
        for (const partyId of [0, n - 1]) {
          const { key, credentials } = JSON.parse(saved[partyId], reviveBuffers);
          credentials.should.have.property('walletPrivKey');
          const stripped = { ...credentials };
          delete stripped.walletPrivKey;
          delete stripped.sharedEncryptingKey;

          const client = helpers.newClient(app);
          client.fromObj(stripped);
          should.not.exist(client.credentials.walletPrivKey);
          should.not.exist(client.credentials.sharedEncryptingKey);

          const urls: Array<string> = [];
          const doRequest = Request.prototype.doRequest;
          sandbox.stub(Request.prototype, 'doRequest').callsFake(function(this: Request, method: string, url: string, ...rest) {
            urls.push(`${method} ${url}`);
            return doRequest.call(this, method, url, ...rest);
          });
          try {
            // Opening the wallet is what loading a wallet file does
            await client.openWallet();
            const { wallet: status } = await client.getStatus({ includeExtendedInfo: true });
            status.name.should.equal(c.walletName);
            status.copayers.map(cp => cp.name).sort().should.deep.equal([...c.copayerNames].sort());
          } finally {
            (Request.prototype.doRequest as sinon.SinonStub).restore();
          }

          client.credentials.walletPrivKey.should.equal(credentials.walletPrivKey);
          client.credentials.sharedEncryptingKey.should.equal(credentials.sharedEncryptingKey);
          urls.filter(u => u.includes('/secret') || u.includes('join-delivery') || /^post \/v\d+\/wallets/.test(u)).should.deep.equal([]);
          recovered.push(JSON.stringify({ key, credentials: client.toObj() }));
        }

        // Recovery happened locally: nothing was added to the stored documents
        stringify(await findOne('tss_keygen', { id: c.sessionId })).should.equal(before.session);
        stringify((await storedWallet(c)).wallet).should.equal(before.wallet);

        const signers = await Promise.all(recovered.map(reopenWallet));
        await signWith(signers);
      });
    });
  }

  describe('a recipient whose enrollment is held back', function() {
    let c: Ceremony;

    before(async function() {
      c = await runCeremony({ n: 3, holdEnrollment: [1] });
    });

    after(function() {
      stopAll(c);
    });

    it('should join the existing wallet later, once, and be able to sign', async function() {
      let { wallets, wallet, lookups } = await storedWallet(c);
      wallets.length.should.equal(1);
      wallet.copayers.length.should.equal(2);
      lookups.length.should.equal(2);
      const before = { id: wallet.id, pubKey: wallet.pubKey, tssKeyId: wallet.tssKeyId, copayerIds: wallet.copayers.map(cp => cp.id) };
      const session = stringify(await findOne('tss_keygen', { id: c.sessionId }));

      // The delivery was published while this recipient was away, and is still there
      const delivery = (await findOne('tss_keygen', { id: c.sessionId })).bwsJoinDelivery;
      delivery.records.map(r => r.partyId).sort().should.deep.equal([1, 2]);

      const joined = await c.tss[1].joinWallet({ copayerName: c.copayerNames[1] });
      joined.id.should.equal(before.id);

      ({ wallets, wallet, lookups } = await storedWallet(c));
      wallets.length.should.equal(1);
      wallet.id.should.equal(before.id);
      wallet.pubKey.should.equal(before.pubKey);
      wallet.tssKeyId.should.equal(before.tssKeyId);
      wallet.copayers.length.should.equal(3);
      lookups.length.should.equal(3);
      before.copayerIds.every(id => wallet.copayers.some(cp => cp.id === id)).should.equal(true);
      stringify(await findOne('tss_keygen', { id: c.sessionId })).should.equal(session);

      // Metadata decrypts and signing works for the latecomer
      const saved = [await saveWallet(c, 0), await saveWallet(c, 1)];
      const signers = await Promise.all(saved.map(reopenWallet));
      const { client } = signers[1];
      (await client.getStatus({})).wallet.name.should.equal(c.walletName);
      await signWith(signers);
    });

    it('should not enroll it twice', async function() {
      await c.tss[1].joinWallet({ copayerName: c.copayerNames[1] }).then(
        () => { throw new Error('expected the second enrollment to fail'); },
        () => {}
      );
      const { wallets, wallet, lookups } = await storedWallet(c);
      wallets.length.should.equal(1);
      wallet.copayers.length.should.equal(3);
      lookups.length.should.equal(3);
    });
  });

  describe('invitations', function() {
    it('should enroll through a password-protected session using the invitation extra, without the secret in it', async function() {
      const password = 'session|password:1';
      const c = await runCeremony({ n: 2, password });
      try {
        const { wallets, lookups } = await storedWallet(c);
        wallets.length.should.equal(1);
        wallets[0].copayers.length.should.equal(2);
        lookups.length.should.equal(2);

        // The password is known to BWS, so nothing sensitive may depend on it or travel with it
        const posts = c.traffic.filter(t => t.method === 'post' && path(t.url).endsWith('/join-delivery'));
        posts.length.should.equal(1);
        stringify(posts[0].body).should.not.include(password);
        for (const value of encodings(c.secret)) {
          stringify(c.traffic).should.not.include(value);
        }
      } finally {
        stopAll(c);
      }
    });

    it('should reject a missing or incorrect password', async function() {
      const key0 = new Key({ seedType: 'new' });
      const key1 = new Key({ seedType: 'new' });
      const creator = mk(key0);
      await creator.newKey({ m: 2, n: 2, password: 'right' });
      // No password in the invitation, so the recipient must supply one
      const code = creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(key1) });
      for (const password of [undefined, 'wrong']) {
        await mk(key1).joinKey({ code, password }).then(
          () => { throw new Error('expected the join to be rejected'); },
          err => { err.message.should.not.equal('expected the join to be rejected'); }
        );
      }
      const session = await findOne('tss_keygen', { id: creator.id });
      session.participants.filter(Boolean).length.should.equal(1);
    });

    it('should enroll through a key-less invitation with the creator key from the trusted exchange', async function() {
      const c = await runCeremony({ n: 2, noKey: true });
      try {
        const { wallets, lookups } = await storedWallet(c);
        wallets.length.should.equal(1);
        wallets[0].copayers.length.should.equal(2);
        lookups.length.should.equal(2);
      } finally {
        stopAll(c);
      }
    });

    it('should reject a key-less invitation without the creator key, or with a different one', async function() {
      const key0 = new Key({ seedType: 'new' });
      const key1 = new Key({ seedType: 'new' });
      const creator = mk(key0);
      await creator.newKey({ m: 2, n: 2 });
      const opts = { noKey: true };
      const code = creator.createJoinCode({ partyId: 1, partyPubKey: pubKeyOf(key1), opts });
      const otherKey = mk(new Key({ seedType: 'new' })).getAuthPublicKey();

      for (const creatorPubKey of [undefined, otherKey]) {
        await mk(key1).joinKey({ code, opts, creatorPubKey }).then(
          () => { throw new Error('expected the join to be rejected'); },
          err => { err.message.should.not.equal('expected the join to be rejected'); }
        );
      }
      // Nothing was enrolled
      const session = await findOne('tss_keygen', { id: creator.id });
      session.participants.filter(Boolean).length.should.equal(1);
      (await find('wallets', { tssKeyId: creator.id })).length.should.equal(0);
    });
  });
});
