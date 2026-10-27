import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { expect } from 'chai';
import sinon from 'sinon';
import { MessageBroker } from '../src/lib/messagebroker';
import { TssKeyGenModel } from '../src/lib/model/tsskeygen';
import { TssSigGenModel } from '../src/lib/model/tsssign';
import { checkTssKeyGenMessage } from '../src/lib/routes/middleware/validateTssKeyGenMessage';
import { checkTssKeyGenRegistration } from '../src/lib/routes/middleware/validateTssKeyGenRegistration';
import { WalletService } from '../src/lib/server';
import { Storage } from '../src/lib/storage';

describe('TSS session subscriptions', function() {
  const sandbox = sinon.createSandbox();
  const broker = new MessageBroker(null);
  let TssKeyGen: typeof import('../src/lib/tss').TssKeyGen;
  let TssSign: typeof import('../src/lib/tss').TssSign;
  let storage: Storage;
  let clock: sinon.SinonFakeTimers;
  let session: TssKeyGenModel;
  let fetchSession: sinon.SinonStub;

  function poll(maxWaitTimeSec = 20) {
    return TssKeyGen.getMessagesForParty({ session, round: 0, copayerId: 'alice', maxWaitTimeSec });
  }

  function completeSession() {
    return Object.assign(new TssKeyGenModel(), session, {
      rounds: [[{
        fromPartyId: 1,
        messages: { partyId: 1, round: 0, publicKey: '', broadcastMessages: [], p2pMessages: [] }
      }]]
    });
  }

  before(async function() {
    const modulePath = require.resolve('../src/lib/tss');
    const cachedModule = require.cache[modulePath];
    delete require.cache[modulePath];
    try {
      ({ TssKeyGen, TssSign } = await import(modulePath));
    } finally {
      if (cachedModule) {
        require.cache[modulePath] = cachedModule;
      } else {
        delete require.cache[modulePath];
      }
    }
  });

  beforeEach(function() {
    clock = sandbox.useFakeTimers();
    storage = new Storage();
    sandbox.stub(WalletService, 'getMessageBroker').returns(broker);
    sandbox.stub(WalletService, 'getStorage').returns(storage);
    session = Object.assign(new TssKeyGenModel(), {
      id: 'session', n: 2, participants: ['alice', 'bob'], rounds: [[]]
    });
    fetchSession = sandbox.stub(storage, 'fetchTssKeyGenSession').resolves(session);
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('uses one broker listener for 20 polls and removes completed subscriptions', async function() {
    const existingHandler = sandbox.stub();
    broker.onMessage(existingHandler);
    try {
      const polls = Array.from({ length: 20 }, () => poll());
      expect(broker.listenerCount('msg')).to.equal(2);

      fetchSession.resolves(completeSession());
      broker.emit('msg', { type: 'TssKeyGenMessage', id: session.id });
      const results = await Promise.all(polls);
      expect(results.every(result => result.messages.length === 1)).to.equal(true);
      expect(existingHandler.calledOnce).to.equal(true);
      expect(clock.countTimers()).to.equal(0);

      fetchSession.resetHistory();
      broker.emit('msg', { type: 'TssKeyGenMessage', id: session.id });
      expect(fetchSession.called).to.equal(false);
      expect(broker.listenerCount('msg')).to.equal(2);
    } finally {
      broker.offMessage(existingHandler);
    }
  });

  it('routes by session ID and message type for keygen and signing', async function() {
    const signingSession = Object.assign(new TssSigGenModel(), {
      id: session.id, m: 2, participants: [{ partyId: 0, copayerId: 'alice' }], rounds: [[]]
    });
    const fetchSigning = sandbox.stub(storage, 'fetchTssSigSession').resolves(signingSession);
    const keygenPoll = poll(1);
    const signingPoll = TssSign.getMessagesForParty({
      session: signingSession, round: 0, copayerId: 'alice', maxWaitTimeSec: 1
    });
    fetchSession.resetHistory();
    fetchSigning.resetHistory();

    broker.emit('msg', { type: 'TssKeyGenMessage', id: 'other-session' });
    broker.emit('msg', { type: 'unrelated', id: session.id });
    expect(fetchSession.called).to.equal(false);
    expect(fetchSigning.called).to.equal(false);
    broker.emit('msg', { type: 'TssKeyGenMessage', id: session.id });
    expect(fetchSession.calledOnce).to.equal(true);
    expect(fetchSigning.called).to.equal(false);
    broker.emit('msg', { type: 'TssSigMessage', id: session.id });
    expect(fetchSigning.calledOnce).to.equal(true);
    expect(fetchSession.calledOnce).to.equal(true);
    expect(broker.listenerCount('msg')).to.equal(1);

    clock.tick(1000);
    await Promise.all([keygenPoll, signingPoll]);
    fetchSession.resetHistory();
    fetchSigning.resetHistory();
    broker.emit('msg', { type: 'TssKeyGenMessage', id: session.id });
    broker.emit('msg', { type: 'TssSigMessage', id: session.id });
    expect(fetchSession.called).to.equal(false);
    expect(fetchSigning.called).to.equal(false);
    expect(broker.listenerCount('msg')).to.equal(1);
  });

  it('removes only the timed-out poll and allows later subscriptions', async function() {
    const shortPoll = poll(1);
    const longPoll = poll(2);
    clock.tick(1000);
    expect(await shortPoll).to.deep.equal({});
    expect(broker.listenerCount('msg')).to.equal(1);
    fetchSession.resetHistory();
    fetchSession.resolves(completeSession());
    broker.emit('msg', { type: 'TssKeyGenMessage', id: session.id });
    expect((await longPoll).messages).to.have.length(1);
    expect(fetchSession.calledOnce).to.equal(true);
    expect(broker.listenerCount('msg')).to.equal(1);

    fetchSession.resolves(session);
    const laterPoll = poll(1);
    expect(broker.listenerCount('msg')).to.equal(1);
    fetchSession.resolves(completeSession());
    broker.emit('msg', { type: 'TssKeyGenMessage', id: session.id });
    expect((await laterPoll).messages).to.have.length(1);
    expect(broker.listenerCount('msg')).to.equal(1);
    expect(clock.countTimers()).to.equal(0);
  });

  it('cleans up when the final database recheck finds a complete round', async function() {
    fetchSession.resolves(completeSession());
    expect((await poll()).messages).to.have.length(1);
    expect(broker.listenerCount('msg')).to.equal(1);
    expect(clock.countTimers()).to.equal(0);
    fetchSession.resetHistory();
    broker.emit('msg', { type: 'TssKeyGenMessage', id: session.id });
    expect(fetchSession.called).to.equal(false);
  });

  it('cleans up when the final database recheck rejects', async function() {
    const failure = new Error('database unavailable');
    fetchSession.rejects(failure);
    const result = await poll().then(() => undefined, err => err);
    expect(result).to.equal(failure);
    expect(broker.listenerCount('msg')).to.equal(1);
    expect(clock.countTimers()).to.equal(0);
    fetchSession.resetHistory();
    broker.emit('msg', { type: 'TssKeyGenMessage', id: session.id });
    expect(fetchSession.called).to.equal(false);
  });

});
describe('TSS join delivery', function() {
  const sandbox = sinon.createSandbox();
  let TssKeyGen: typeof import('../src/lib/tss').TssKeyGen;
  let storage: Storage;
  let session: TssKeyGenModel;
  let storeDelivery: sinon.SinonStub;
  let fetchSession: sinon.SinonStub;

  const rec = (partyId: number, tag = '') => ({ partyId, encryptedMessage: 'ct' + partyId + tag, signature: 'sig' + partyId + tag });
  const publish = (records: any, extra: object = {}) =>
    TssKeyGen.storeJoinDelivery({ id: 'session', version: 1, records, copayerId: 'alice', ...extra });
  const rejection = (p: Promise<any>) => p.then(() => undefined, err => err);

  before(async function() {
    ({ TssKeyGen } = await import('../src/lib/tss'));
  });

  beforeEach(function() {
    storage = new Storage();
    sandbox.stub(WalletService, 'getStorage').returns(storage);
    session = Object.assign(new TssKeyGenModel(), {
      id: 'session', n: 3, participants: ['alice', 'bob', 'carol'], rounds: [[]]
    });
    fetchSession = sandbox.stub(storage, 'fetchTssKeyGenSession').callsFake(async () => session);
    storeDelivery = sandbox.stub(storage, 'storeTssKeyJoinDelivery').callsFake(async ({ delivery }) => {
      session.bwsJoinDelivery = delivery;
      return { result: { ok: 1 }, matchedCount: 1 } as any;
    });
  });

  afterEach(function() {
    sandbox.restore();
  });

  it('stores one complete set covering exactly the noncreator participants', async function() {
    await publish([rec(2), { ...rec(1), extra: 'dropped' }]);
    expect(storeDelivery.calledOnce).to.equal(true);
    expect(session.bwsJoinDelivery).to.deep.equal({ version: 1, records: [rec(1), rec(2)] });
  });

  it('rejects bad sets without changing stored delivery', async function() {
    await publish([rec(1), rec(2)]);
    const stored = JSON.stringify(session.bwsJoinDelivery);
    storeDelivery.resetHistory();
    const big = 'x'.repeat(16 * 1024 + 1);
    const bad: Array<{ name: string; records: any; extra?: object; message: string }> = [
      { name: 'missing recipient', records: [rec(1)], message: 'expected one record' },
      { name: 'too many records', records: [rec(1), rec(2), rec(3)], message: 'expected one record' },
      { name: 'duplicate recipient', records: [rec(1), rec(1)], message: 'duplicate recipient' },
      { name: 'creator-addressed', records: [rec(0), rec(1)], message: 'unknown recipient' },
      { name: 'unknown recipient', records: [rec(1), rec(3)], message: 'unknown recipient' },
      { name: 'non-integer party', records: [rec(1), { ...rec(2), partyId: '2' }], message: 'unknown recipient' },
      { name: 'empty ciphertext', records: [rec(1), { ...rec(2), encryptedMessage: '' }], message: 'malformed record' },
      { name: 'non-string signature', records: [rec(1), { ...rec(2), signature: {} }], message: 'malformed record' },
      { name: 'oversized ciphertext', records: [rec(1), { ...rec(2), encryptedMessage: big }], message: 'malformed record' },
      { name: 'non-array', records: 'nope', message: 'expected one record' },
      { name: 'null record', records: [rec(1), null], message: 'unknown recipient' },
      { name: 'unsupported version', records: [rec(1), rec(2)], extra: { version: 2 }, message: 'unsupported version' },
    ];
    for (const { name, records, extra, message } of bad) {
      const err = await rejection(publish(records, extra));
      expect(err, name).to.have.property('message').that.includes('Invalid join delivery: ' + message);
    }
    expect(storeDelivery.called).to.equal(false);
    expect(JSON.stringify(session.bwsJoinDelivery)).to.equal(stored);
  });

  it('rejects a recipient that has not enrolled in the session roster', async function() {
    session.participants = ['alice', 'bob', null];
    expect(await rejection(publish([rec(1), rec(2)]))).to.have.property('message', 'Invalid join delivery: unknown recipient');
    expect(storeDelivery.called).to.equal(false);
    expect(session.bwsJoinDelivery).to.equal(undefined);
  });

  it('rejects publication by a noncreator', async function() {
    expect(await rejection(publish([rec(1), rec(2)], { copayerId: 'bob' })))
      .to.have.property('message', 'Only the session creator can store the join delivery');
    expect(storeDelivery.called).to.equal(false);
  });

  it('rejects a missing session', async function() {
    const { Errors } = await import('../src/lib/errors/errordefinitions');
    fetchSession.resolves(null);
    expect(await rejection(publish([rec(1), rec(2)]))).to.equal(Errors.TSS_SESSION_NOT_FOUND);
    expect(storeDelivery.called).to.equal(false);
  });

  it('fails if storage matched no session', async function() {
    storeDelivery.resolves({ result: { ok: 1 }, matchedCount: 0 });
    expect(await rejection(publish([rec(1), rec(2)])))
      .to.have.property('message', 'Failed to store TSS key generation join delivery');
  });

  it('returns only the calling party record and does not consume the delivery', async function() {
    await publish([rec(1), rec(2)]);
    const before = JSON.stringify(session);
    for (let i = 0; i < 2; i++) {
      expect(await TssKeyGen.getJoinDelivery({ id: 'session', copayerId: 'bob' }))
        .to.deep.equal({ version: 1, encryptedMessage: 'ct1', signature: 'sig1' });
    }
    expect(await TssKeyGen.getJoinDelivery({ id: 'session', copayerId: 'carol' }))
      .to.deep.equal({ version: 1, encryptedMessage: 'ct2', signature: 'sig2' });
    expect(JSON.stringify(session)).to.equal(before);
  });

  it('reports pending before publication, distinguishable from other errors', async function() {
    const { Errors } = await import('../src/lib/errors/errordefinitions');
    expect(await rejection(TssKeyGen.getJoinDelivery({ id: 'session', copayerId: 'bob' })))
      .to.equal(Errors.TSS_JOIN_DELIVERY_PENDING);
  });

  it('gives outsiders and the creator no delivery', async function() {
    const { Errors } = await import('../src/lib/errors/errordefinitions');
    await publish([rec(1), rec(2)]);
    expect(await rejection(TssKeyGen.getJoinDelivery({ id: 'session', copayerId: 'mallory' })))
      .to.equal(Errors.TSS_NON_PARTICIPANT);
    expect(await rejection(TssKeyGen.getJoinDelivery({ id: 'session', copayerId: 'alice' })))
      .to.have.property('message', 'The session creator has no join delivery');
  });

  it('lets a complete replacement set overwrite the previous one', async function() {
    await publish([rec(1), rec(2)]);
    await publish([rec(1, 'b'), rec(2, 'b')]);
    expect(await TssKeyGen.getJoinDelivery({ id: 'session', copayerId: 'bob' }))
      .to.deep.equal({ version: 1, encryptedMessage: 'ct1b', signature: 'sig1b' });
  });

  it('issues one non-upserting $set, and the model round trips the delivery', async function() {
    const updateOne = sinon.stub().resolves({ result: { ok: 1 }, matchedCount: 1 });
    const real = new Storage();
    (real as any).db = { collection: () => ({ updateOne }) };
    const delivery = { version: 1, records: [rec(1), rec(2)] };
    await real.storeTssKeyJoinDelivery({ id: 'session', delivery });
    expect(updateOne.calledOnceWithExactly({ id: 'session' }, { $set: { bwsJoinDelivery: delivery } }, { upsert: false })).to.equal(true);

    const doc = TssKeyGenModel.fromObj({ ...session, bwsJoinDelivery: delivery, __v: 0 } as any);
    expect(doc.bwsJoinDelivery).to.deep.equal(delivery);
    expect(doc.participants).to.deep.equal(session.participants);
    expect(doc.n).to.equal(3);
  });

});

describe('KeyGen admission', function() {
  const sandbox = sinon.createSandbox();
  let TssKeyGen: typeof import('../src/lib/tss').TssKeyGen;
  let storage: Storage;
  let updateOne: sinon.SinonStub;
  let insertOne: sinon.SinonStub;
  let brokerSend: sinon.SinonStub;
  let fetchSession: sinon.SinonStub;

  const N = 3;
  const broadcast = (partyId: number, round = 0, publicKey = 'key' + partyId) => ({
    round, partyId, publicKey,
    broadcastMessages: [{ from: partyId, payload: { message: 'm', signature: 's' } }],
    p2pMessages: []
  });
  const p2p = (partyId: number, round = 1, publicKey = 'key' + partyId) => ({
    round, partyId, publicKey,
    broadcastMessages: [],
    p2pMessages: [0, 1, 2].filter(to => to !== partyId).map(to => ({
      from: partyId, to, commitment: 'c', payload: { encryptedMessage: 'e', signature: 's' }
    }))
  });
  const makeSession = (opts: { version?: number; joined?: number[]; registered?: number[]; participants?: string[] } = {}) => {
    const { version = 1.1, joined = [], registered = [] } = opts;
    const session = Object.assign(new TssKeyGenModel(), {
      id: 'session',
      n: N,
      schemeVersion: version,
      participants: opts.participants ?? ['alice', null, null],
      authPublicKeys: ['key0', null, null],
      rounds: [[{ fromPartyId: 0, messages: broadcast(0) }]],
      __v: 0
    });
    for (const partyId of registered) session.authPublicKeys[partyId] = 'key' + partyId;
    for (const partyId of joined) {
      session.authPublicKeys[partyId] = 'key' + partyId;
      session.participants[partyId] = ['alice', 'bob', 'carol'][partyId];
      session.rounds[0].push({ fromPartyId: partyId, messages: broadcast(partyId) });
    }
    return session;
  };
  const submit = (message: any, copayerId = 'bob', extra: { version?: number; password?: string } = {}) =>
    TssKeyGen.processMessage({ id: 'session', message, copayerId, version: extra.version ?? 1.1, password: extra.password });
  const rejection = (p: Promise<any>) => p.then(() => undefined, err => err);
  /** Writes that reached the database, whatever the storage method that issued them */
  const writes = () => updateOne.getCalls().concat(insertOne.getCalls());
  const expectRefused = async (p: Promise<any>) => {
    const err = await rejection(p);
    expect(err, 'expected a rejection').to.not.equal(undefined);
    expect(err).to.not.be.instanceOf(TypeError);
    expect(writes(), 'a write reached the database').to.have.length(0);
    expect(brokerSend.called, 'a notification was published').to.equal(false);
    return err;
  };

  before(async function() {
    ({ TssKeyGen } = await import('../src/lib/tss'));
  });

  beforeEach(function() {
    storage = new Storage();
    updateOne = sandbox.stub().resolves({ result: { ok: 1 }, matchedCount: 1 });
    insertOne = sandbox.stub().resolves({ result: { ok: 1 } });
    (storage as any).db = { collection: () => ({ updateOne, insertOne, countDocuments: sandbox.stub().resolves(1) }) };
    brokerSend = sandbox.stub();
    sandbox.stub(WalletService, 'getStorage').returns(storage);
    sandbox.stub(WalletService, 'getMessageBroker').returns({ send: brokerSend } as any);
    fetchSession = sandbox.stub(storage, 'fetchTssKeyGenSession').resolves(makeSession());
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('direct service boundaries', function() {
    it('should reject a partyId equal to n before any write', async function() {
      await expectRefused(submit(broadcast(N)));
    });

    it('should reject a non-canonical partyId before any write', async function() {
      await expectRefused(submit(broadcast(NaN)));
    });

    it('should reject a p2p recipient equal to n before any write', async function() {
      fetchSession.resolves(makeSession({ joined: [1, 2] }));
      const message = p2p(1);
      message.p2pMessages[0].to = N;
      await expectRefused(submit(message));
    });

    it('should reject a later-round message for a vacant slot without enrolling it', async function() {
      await expectRefused(submit(p2p(1)));
    });

    it('should reject a round 0 message for a vacant slot whose round 0 message exists', async function() {
      const session = makeSession({ joined: [1] });
      session.participants[1] = null;
      fetchSession.resolves(session);
      await expectRefused(submit(broadcast(1)));
    });
  });

  describe('ownership and key binding', function() {
    it('should reject another copayer for an enrolled slot', async function() {
      fetchSession.resolves(makeSession({ joined: [1] }));
      await expectRefused(submit(broadcast(1), 'mallory'));
    });

    it('should reject an enrolled copayer claiming a second slot', async function() {
      fetchSession.resolves(makeSession({ joined: [1] }));
      await expectRefused(submit(broadcast(2), 'bob'));
    });

    it('should reject an enrolled sender submitting a different wrapper key', async function() {
      fetchSession.resolves(makeSession({ joined: [1, 2] }));
      await expectRefused(submit(p2p(1, 1, 'other-key'), 'bob'));
    });

    it('should reject a v1.2 joiner whose key is not the registered key for the slot', async function() {
      fetchSession.resolves(makeSession({ version: 1.2, registered: [1] }));
      await expectRefused(submit(broadcast(1, 0, 'other-key'), 'bob', { version: 1.2 }));
    });

    it('should reject a wrong join password', async function() {
      const session = makeSession();
      session.joinPassword = 'not-the-hash';
      fetchSession.resolves(session);
      await expectRefused(submit(broadcast(1), 'bob', { password: 'wrong' }));
    });
  });

  describe('atomic admission', function() {
    it('should commit an enrollment and its first message with one write', async function() {
      await submit(broadcast(1));
      expect(writes(), 'enrollment and message must share one write').to.have.length(1);
      expect(brokerSend.calledOnce).to.equal(true);
    });

    it('should not leave a participant enrolled when the message cannot be stored', async function() {
      updateOne.callsFake(async (_filter, update) => {
        if (update.$push) throw new Error('injected failure');
        return { result: { ok: 1 }, matchedCount: 1 };
      });
      const err = await rejection(submit(broadcast(1)));
      expect(err?.message).to.equal('injected failure');
      const enrolled = updateOne.getCalls().filter(c => Object.keys(c.args[1].$set || {}).some(k => k.startsWith('participants.')));
      expect(enrolled, 'a participant write succeeded without its message').to.have.length(0);
      expect(brokerSend.called).to.equal(false);
    });
  });

  describe('session creation', function() {
    const create = (n: any) => {
      fetchSession.resolves(null);
      return TssKeyGen.processMessage({ id: 'session', message: broadcast(0), n, copayerId: 'alice', version: 1.1 });
    };

    for (const [name, n] of [['zero', 0], ['negative', -1], ['not a number', 'abc'], ['missing', undefined], ['NaN', NaN],
      ['past the array length limit', 2 ** 32], ['past the safe integer range', 2 ** 53], ['a numeric string past the limit', '4294967296']] as Array<[string, any]>) {
      it(`should reject a participant count that is ${name}`, async function() {
        const err = await rejection(create(n));
        expect(err?.code).to.equal('TSS_GENERIC_ERROR');
        expect(writes()).to.have.length(0);
      });
    }

    for (const [name, n] of [['a number', 3], ['a numeric string', '3']] as Array<[string, any]>) {
      it(`should create a session with a participant count given as ${name}`, async function() {
        await create(n);
        expect(insertOne.calledOnce).to.equal(true);
        expect(insertOne.firstCall.args[0].participants).to.have.length(3);
      });
    }

    it('should reject a session whose first message is not party 0 round 0', async function() {
      fetchSession.resolves(null);
      for (const message of [broadcast(1), broadcast(0, 1), { ...broadcast(0), partyId: '0' }]) {
        const err = await rejection(TssKeyGen.processMessage({ id: 'session', message: message as any, n: 3, copayerId: 'alice', version: 1.1 }));
        expect(err).to.not.equal(undefined);
      }
      expect(writes()).to.have.length(0);
    });
  });

  describe('retries after a version conflict', function() {
    const conflictOnce = () => updateOne.onFirstCall().resolves({ result: { ok: 1 }, matchedCount: 0 });
    const statesInOrder = (...states: any[]) => {
      fetchSession.callsFake(async () => states.length > 1 ? states.shift() : states[0]);
    };

    it('should admit after another slot joined meanwhile', async function() {
      conflictOnce();
      statesInOrder(makeSession(), makeSession({ joined: [2] }));
      await submit(broadcast(1));
      expect(brokerSend.calledOnce).to.equal(true);
      expect(updateOne.callCount).to.equal(2);
    });

    it('should reject when another copayer took the slot meanwhile', async function() {
      conflictOnce();
      statesInOrder(makeSession(), makeSession({ joined: [1], participants: ['alice', 'carol', null] }));
      const err = await rejection(submit(broadcast(1)));
      expect(err).to.not.equal(undefined);
      expect(updateOne.callCount).to.equal(1);
      expect(brokerSend.called).to.equal(false);
    });

    it('should reject a pending v1.2 join when the creator changed the registered key meanwhile', async function() {
      conflictOnce();
      const replaced = makeSession({ version: 1.2, registered: [1] });
      replaced.authPublicKeys[1] = 'replacement-key';
      statesInOrder(makeSession({ version: 1.2, registered: [1] }), replaced);
      const err = await rejection(submit(broadcast(1), 'bob', { version: 1.2 }));
      expect(err).to.not.equal(undefined);
      expect(updateOne.callCount).to.equal(1);
      expect(brokerSend.called).to.equal(false);
    });

    it('should reject when the session expired meanwhile', async function() {
      conflictOnce();
      const expired = makeSession();
      expired.createdOn = Date.now() - 2 * 60 * 60 * 1000;
      expired.timeLimit = 60 * 1000;
      statesInOrder(makeSession(), expired);
      const err = await rejection(submit(broadcast(1)));
      expect(err?.code).to.equal('TSS_SESSION_EXPIRED');
      expect(updateOne.callCount).to.equal(1);
    });
  });
});

describe('KeyGen admission request shape validators', function() {
  const broadcastItem = (from: number) => ({ from, payload: { message: 'm', signature: 's' } });
  const p2pItem = (from: number, to: number) => ({ from, to, commitment: 'c', payload: { encryptedMessage: 'e', signature: 's' } });
  const messageBody = (overrides: object = {}) => ({
    message: { round: 0, partyId: 1, publicKey: 'key', broadcastMessages: [broadcastItem(1)], p2pMessages: [], ...overrides }
  });
  const p2pBody = (overrides: object = {}) => messageBody({ round: 1, broadcastMessages: [], p2pMessages: [p2pItem(1, 0), p2pItem(1, 2)], ...overrides });
  const valid = (body: unknown) => expect(checkTssKeyGenMessage(body)).to.equal(null);
  const invalid = (body: unknown) => expect(checkTssKeyGenMessage(body)).to.be.a('string');
  const withoutKey = (body: any, key: string) => {
    const { [key]: _omitted, ...rest } = body.message;
    return { message: rest };
  };

  const notCanonicalIds: Array<[string, any]> = [
    ['"00"', '00'], ['"0"', '0'], ['"1"', '1'], ['"01"', '01'], ['"1.0"', '1.0'], ['"1e0"', '1e0'], ['"1.x"', '1.x'],
    ['null', null], ['undefined', undefined], ['true', true], ['an object', {}], ['an array', [1]],
    ['-1', -1], ['-0', -0], ['0.5', 0.5], ['1.9', 1.9], ['NaN', NaN], ['Infinity', Infinity], ['-Infinity', -Infinity],
    ['an unsafe integer', 2 ** 53]
  ];

  describe('message', function() {
    it('should accept well-formed broadcast and p2p messages for every submitted round', function() {
      valid(messageBody());
      for (const round of [0, 1, 2, 3]) {
        valid(p2pBody({ round }));
        valid(messageBody({ round }));
      }
      valid(messageBody({ partyId: 0, broadcastMessages: [broadcastItem(0)] }));
    });

    for (const [name, value] of notCanonicalIds) {
      it(`should reject partyId ${name}`, function() {
        invalid(messageBody({ partyId: value }));
      });

      it(`should reject round ${name}`, function() {
        invalid(messageBody({ round: value }));
      });

      it(`should reject a p2p recipient that is ${name}`, function() {
        invalid(p2pBody({ p2pMessages: [p2pItem(1, 0), { ...p2pItem(1, 2), to: value }] }));
      });
    }

    it('should reject a missing partyId or round', function() {
      invalid(withoutKey(messageBody(), 'partyId'));
      invalid(withoutKey(messageBody(), 'round'));
    });

    for (const round of [4, 5, 6, 2 ** 31]) {
      it(`should reject unsupported round ${round}`, function() {
        invalid(messageBody({ round }));
      });
    }

    for (const [name, body] of [['null', null], ['undefined', undefined], ['an array', []], ['a string', 'x'], ['a missing message', {}],
      ['a null message', { message: null }], ['an array message', { message: [] }], ['a string message', { message: 'x' }]] as Array<[string, any]>) {
      it(`should reject a body that is ${name}`, function() {
        invalid(body);
      });
    }

    it('should reject malformed payload arrays', function() {
      invalid(withoutKey(messageBody(), 'broadcastMessages'));
      invalid(withoutKey(messageBody(), 'p2pMessages'));
      invalid(messageBody({ broadcastMessages: {} }));
      invalid(messageBody({ p2pMessages: 'x' }));
      invalid(messageBody({ broadcastMessages: [], p2pMessages: [] }));
    });

    it('should reject malformed broadcast items', function() {
      for (const item of [null, undefined, 'x', 1, [], {}, { from: 1 }, { from: 1, payload: null },
        { from: 1, payload: { message: 'm' } }, { from: 1, payload: { signature: 's' } },
        { from: 1, payload: { message: 1, signature: 's' } }, { from: 1, payload: { message: 'm', signature: {} } }]) {
        invalid(messageBody({ broadcastMessages: [broadcastItem(1), item] }));
        invalid(messageBody({ broadcastMessages: [item] }));
      }
    });

    it('should reject malformed p2p items', function() {
      for (const item of [null, undefined, 'x', 1, [], {}, { from: 1, to: 0 }, { from: 1, to: 0, commitment: 'c' },
        { from: 1, to: 0, commitment: 1, payload: { encryptedMessage: 'e', signature: 's' } },
        { from: 1, to: 0, commitment: 'c', payload: null },
        { from: 1, to: 0, commitment: 'c', payload: { encryptedMessage: 'e' } },
        { from: 1, to: 0, commitment: 'c', payload: { signature: 's' } }]) {
        invalid(p2pBody({ p2pMessages: [p2pItem(1, 0), item] }));
        invalid(p2pBody({ p2pMessages: [item] }));
      }
    });

    it('should reject a nested sender that differs from the outer partyId in any item', function() {
      invalid(messageBody({ broadcastMessages: [broadcastItem(0)] }));
      invalid(messageBody({ broadcastMessages: [broadcastItem(1), broadcastItem(2)] }));
      invalid(messageBody({ broadcastMessages: [{ ...broadcastItem(1), from: '1' }] }));
      invalid(p2pBody({ p2pMessages: [p2pItem(0, 2)] }));
      invalid(p2pBody({ p2pMessages: [p2pItem(1, 0), p2pItem(2, 0)] }));
      invalid(p2pBody({ p2pMessages: [{ ...p2pItem(1, 0), from: '1' }] }));
    });

    it('should reject a p2p message addressed to its own sender', function() {
      invalid(p2pBody({ p2pMessages: [p2pItem(1, 1)] }));
      invalid(p2pBody({ p2pMessages: [p2pItem(1, 0), p2pItem(1, 1)] }));
    });

    it('should leave cryptographic and key fields opaque', function() {
      valid(messageBody({ publicKey: undefined }));
      valid(messageBody({ publicKey: 'not-a-key' }));
      valid(messageBody({ broadcastMessages: [{ from: 1, payload: { message: 'not base64', signature: 'not a signature' } }] }));
    });
  });

  describe('registration', function() {
    const publicKey = new BitcoreLib.PrivateKey().publicKey.toString();
    const validReg = (body: unknown) => expect(checkTssKeyGenRegistration(body)).to.equal(null);
    const invalidReg = (body: unknown) => expect(checkTssKeyGenRegistration(body)).to.be.a('string');

    it('should accept a positive integer partyId with a public key', function() {
      validReg({ partyId: 1, partyPubKey: publicKey });
      validReg({ partyId: 2, partyPubKey: publicKey });
      validReg({ partyId: 1, partyPubKey: `  ${publicKey}  ` });
      validReg({ partyId: 1, partyPubKey: new BitcoreLib.PrivateKey().publicKey.toBuffer().toString('hex') });
    });

    for (const [name, value] of [...notCanonicalIds, ['0', 0]] as Array<[string, any]>) {
      it(`should reject partyId ${name}`, function() {
        invalidReg({ partyId: value, partyPubKey: publicKey });
      });
    }

    it('should reject a missing partyId', function() {
      invalidReg({ partyPubKey: publicKey });
    });

    for (const [name, value] of [['missing', undefined], ['null', null], ['a number', 123], ['an object', {}], ['empty', ''], ['blank', '   '],
      ['not hex', 'not-a-key'], ['a 32 byte hash', 'a'.repeat(64)], ['a truncated key', publicKey.slice(0, 40)],
      ['a key with trailing bytes', publicKey + '00'], ['a key with a bad prefix', '05' + publicKey.slice(2)], ['a point off the curve', '02' + '5'.padStart(64, '0')]] as Array<[string, any]>) {
      it(`should reject a public key that is ${name}`, function() {
        invalidReg({ partyId: 1, partyPubKey: value });
      });
    }

    for (const [name, body] of [['null', null], ['undefined', undefined], ['an array', []], ['a string', 'x']] as Array<[string, any]>) {
      it(`should reject a body that is ${name}`, function() {
        invalidReg(body);
      });
    }
  });
});
