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

  const validRounds: Array<number> = [0, 1, 2, 3];

  describe('message', function() {
    it('should accept well-formed broadcast and p2p messages for every submitted round', function() {
      valid(messageBody());
      for (const round of validRounds) {
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
