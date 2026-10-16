import { expect } from 'chai';
import sinon from 'sinon';
import { MessageBroker } from '../src/lib/messagebroker';
import { TssKeyGenModel } from '../src/lib/model/tsskeygen';
import { TssSigGenModel } from '../src/lib/model/tsssign';
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
