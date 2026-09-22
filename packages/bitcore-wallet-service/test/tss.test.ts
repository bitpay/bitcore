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