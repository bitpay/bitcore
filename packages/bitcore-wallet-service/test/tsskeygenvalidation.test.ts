import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { expect } from 'chai';
import express from 'express';
import { get, set } from 'lodash';
import sinon from 'sinon';
import request from 'supertest';
import { Utils } from '../src/lib/common/utils';
import { TssRouter } from '../src/lib/routes/tss';
import { WalletService } from '../src/lib/server';
import { Storage } from '../src/lib/storage';

describe('KeyGen request validation', function() {
  const sandbox = sinon.createSandbox();
  const keys = [0, 1, 2].map(() => new BitcoreLib.PrivateKey());
  const participants = ['creator', 'joiner', 'other'];
  const path = '/v1/tss/keygen/session';
  let doc: any;
  let app: express.Express;
  let findOne: sinon.SinonStub;
  let updateOne: sinon.SinonStub;
  let insertOne: sinon.SinonStub;
  let send: sinon.SinonStub;

  function message(partyId = 1) {
    return {
      partyId, round: 1, publicKey: keys[partyId].publicKey.toString(), broadcastMessages: [],
      p2pMessages: [0, 1, 2].filter(to => to !== partyId).map(to => ({
        from: partyId, to, commitment: 'commitment', payload: { encryptedMessage: 'encrypted', signature: 'signature' }
      }))
    };
  }

  function post(body: object, partyId = 1, url = path) {
    const hash = Utils.hashMessage(`post|${url}|${JSON.stringify(body)}`, false);
    const signature = BitcoreLib.crypto.ECDSA.sign(hash, keys[partyId], { endian: 'little' }).toString();
    return request(app).post('/bws/api' + url)
      .set('x-identity', participants[partyId]).set('x-signature', signature).send(body);
  }

  async function rejected(body: object, code: string, partyId = 1, url = path) {
    const before = JSON.stringify(doc);
    const res = await post(body, partyId, url);
    expect(res.status).to.be.oneOf([400, 401]);
    expect(res.body.code).to.equal(code);
    expect(JSON.stringify(doc)).to.equal(before);
    expect(updateOne.called || insertOne.called || send.called).to.equal(false);
  }

  beforeEach(function() {
    doc = {
      id: 'session', schemeVersion: 1.2, n: 3, participants: [...participants],
      authPublicKeys: keys.map(key => key.publicKey.toString()),
      rounds: [keys.map((key, partyId) => ({
        fromPartyId: partyId, messages: { ...message(partyId), round: 0, publicKey: key.publicKey.toString() }
      }))],
      createdOn: Date.now(), timeLimit: 60_000, __v: 0
    };
    findOne = sandbox.stub().callsFake(async () => doc && JSON.parse(JSON.stringify(doc)));
    updateOne = sandbox.stub().callsFake(async (filter, change) => {
      for (const [field, value] of Object.entries(filter)) {
        if (get(doc, field) !== value) return { matchedCount: 0, result: { ok: 1 } };
      }
      for (const [field, value] of Object.entries(change.$set || {})) set(doc, field, value);
      for (const [field, value] of Object.entries(change.$push || {})) {
        if (!get(doc, field)) set(doc, field, []);
        get(doc, field).push(value);
      }
      for (const [field, value] of Object.entries(change.$inc || {})) set(doc, field, get(doc, field) + value);
      return { matchedCount: 1, result: { ok: 1 } };
    });
    insertOne = sandbox.stub().callsFake(async value => {
      doc = value;
      return { result: { ok: 1 } };
    });
    const storage = new Storage({ db: { collection: () => ({ findOne, updateOne, insertOne }) } as any });
    sandbox.stub(WalletService, 'getStorage').returns(storage);
    send = sandbox.stub();
    sandbox.stub(WalletService, 'getMessageBroker').returns({ send } as any);
    const router = new TssRouter({
      opts: { ignoreRateLimiter: true },
      returnError: (err, res) => res.status(400).json({ code: err.code, message: err.message })
    });
    app = express();
    app.use(express.json());
    app.use('/bws/api', router.router);
  });

  afterEach(function() {
    sandbox.restore();
  });

  for (const version of [1.1, 1.2]) {
    for (const enrolled of [false, true]) {
      for (const partyId of ['00', '1', null, undefined, -1, 1.5, 2 ** 53]) {
        it(`rejects partyId ${String(partyId)} from an ${enrolled ? 'enrolled sender' : 'outsider'} in scheme ${version} before session lookup`, async function() {
          doc.schemeVersion = version;
          if (!enrolled) doc.participants[1] = null;
          await rejected({ message: { ...message(), partyId }, version }, 'TSS_INVALID_MESSAGE');
          expect(findOne.called).to.equal(false);
        });
      }
    }
  }

  for (const partyId of [3, 4]) {
    it(`rejects numeric partyId ${partyId} outside the session range`, async function() {
      const msg = message();
      msg.partyId = partyId;
      msg.p2pMessages = [{ ...msg.p2pMessages[0], from: partyId }];
      await rejected({ message: msg, version: 1.2 }, 'TSS_INVALID_MESSAGE');
    });
  }

  it('rejects an enrolled caller claiming another slot even with matching nested senders', async function() {
    await rejected({ message: message(2), version: 1.2 }, 'NOT_AUTHORIZED');
  });

  it('rejects a P2P recipient outside the session range', async function() {
    const msg = message();
    msg.p2pMessages[0].to = doc.n;
    await rejected({ message: msg, version: 1.2 }, 'TSS_INVALID_MESSAGE');
  });

  it('rejects inconsistent nested senders before session lookup', async function() {
    const msg = message();
    msg.p2pMessages[1].from = 2;
    await rejected({ message: msg, version: 1.2 }, 'TSS_INVALID_MESSAGE');
    expect(findOne.called).to.equal(false);
  });

  it('rejects a malformed session-starting message without creating a session', async function() {
    doc = null;
    await rejected({ message: { ...message(0), partyId: '0', round: 0 }, n: 3, version: 1.2 }, 'TSS_INVALID_MESSAGE', 0);
    expect(findOne.called).to.equal(false);
  });

  for (const partyId of ['1', '01', 1.5, 0, 2 ** 53]) {
    it(`rejects registration partyId ${partyId} before session lookup`, async function() {
      await rejected({ partyId, partyPubKey: keys[1].publicKey.toString() }, 'TSS_INVALID_PARTY_DATA', 0, path + '/register');
      expect(findOne.called).to.equal(false);
    });
  }

  it('rejects a registration slot outside the session range', async function() {
    await rejected({ partyId: 3, partyPubKey: keys[1].publicKey.toString() }, 'TSS_INVALID_PARTY_DATA', 0, path + '/register');
  });

  for (const version of [1.1, 1.2]) {
    it(`accepts a valid numeric slot and persists its P2P message in scheme ${version}`, async function() {
      doc.schemeVersion = version;
      const res = await post({ message: message(), version });
      expect(res.status).to.equal(200);
      expect(doc.rounds[1]).to.have.length(1);
      expect(doc.rounds[1][0].fromPartyId).to.equal(1);
      expect(doc.participants).to.deep.equal(participants);
      expect(send.calledOnce).to.equal(true);
    });
  }

  it('accepts a valid numeric registration slot', async function() {
    doc.participants[1] = null;
    doc.authPublicKeys[1] = null;
    doc.rounds[0].splice(1, 1);
    const res = await post({ partyId: 1, partyPubKey: keys[1].publicKey.toString() }, 0, path + '/register');
    expect(res.status).to.equal(200);
    expect(doc.authPublicKeys[1]).to.equal(keys[1].publicKey.toString());
    expect(doc.participants[1]).to.equal(null);
  });
});
