import { expect } from 'chai';
import express from 'express';
import sinon from 'sinon';
import request from 'supertest';
import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { Utils } from '../src/lib/common/utils';
import { TssKeyGenModel } from '../src/lib/model/tsskeygen';
import { TssRouter } from '../src/lib/routes/tss';
import { WalletService } from '../src/lib/server';
import { Storage } from '../src/lib/storage';

describe('TSS wallet join compatibility', function() {
  const sandbox = sinon.createSandbox();
  const keys = [0, 1, 2].map(() => new BitcoreLib.PrivateKey());
  const participants = ['creator', 'joiner1', 'joiner2'];
  const path = '/v1/tss/keygen/session/secret';
  const legacySecret = 'legacy-wallet-join-secret';
  const delivery = {
    records: [1, 2].map(partyId => ({ partyId, encryptedMessage: 'encrypted-' + partyId, signature: 'signature-' + partyId }))
  };
  let doc: any;
  let app: express.Express;
  let update: sinon.SinonStub;

  // Exercise the actual routes, request authentication, model hydration and storage
  // updates, with only the MongoDB collection replaced.
  beforeEach(function() {
    doc = {
      id: 'session', schemeVersion: 1.3, n: 3, participants,
      authPublicKeys: keys.map(k => k.publicKey.toString()),
      rounds: [keys.map((k, partyId) => ({
        fromPartyId: partyId,
        messages: { partyId, round: 0, publicKey: k.publicKey.toString(), broadcastMessages: [], p2pMessages: [] }
      }))],
      createdOn: Date.now(), timeLimit: 60_000, __v: 0
    };
    update = sandbox.stub().callsFake(async (filter, change) => {
      expect(filter).to.deep.equal({ id: doc.id });
      Object.assign(doc, change.$set);
      return { result: { ok: 1 } };
    });
    const collection = { findOne: async () => doc, updateOne: update };
    const storage = new Storage({ db: { collection: () => collection } as any });
    sandbox.stub(WalletService, 'getStorage').returns(storage);
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

  function signed(method: 'get' | 'post', body = {}, partyId = 0, url = path) {
    const hash = Utils.hashMessage(`${method}|${url}|${JSON.stringify(body)}`, false);
    const signature = BitcoreLib.crypto.ECDSA.sign(hash, keys[partyId], { endian: 'little' }).toString();
    const req = request(app)[method]('/bws/api' + url)
      .set('x-identity', participants[partyId])
      .set('x-signature', signature);
    return method === 'post' ? req.send(body) : req;
  }

  for (const version of [1, 1.1, 1.2]) {
    describe(`legacy scheme ${version}`, function() {
      beforeEach(function() {
        doc.schemeVersion = version;
        if (version < 1.2) delete doc.authPublicKeys;
      });

      it('accepts the old POST body and repeatedly returns the old GET shape to every participant', async function() {
        expect((await signed('post', { secret: legacySecret })).status).to.equal(200);
        expect(update.firstCall.args[1]).to.deep.equal({ $set: { bwsJoinSecret: legacySecret } });
        expect(doc).not.to.have.property('bwsJoinSecrets');
        for (let i = 0; i < 2; i++) {
          for (const partyId of [0, 1, 2]) {
            const res = await signed('get', {}, partyId);
            expect(res.status).to.equal(200);
            expect(res.body).to.deep.equal({ secret: legacySecret });
          }
        }
      });

      it('reads plaintext documents written before the server upgrade', async function() {
        doc.bwsJoinSecret = legacySecret;
        expect(TssKeyGenModel.fromObj(doc).bwsJoinSecret).to.equal(legacySecret);
        expect((await signed('get', {}, 1)).body).to.deep.equal({ secret: legacySecret });
        expect(update.called).to.equal(false);
      });

      it('rejects publication by a joiner', async function() {
        expect((await signed('post', { secret: legacySecret }, 1)).status).to.equal(400);
        expect(update.called).to.equal(false);
      });

      it('rejects malformed or encrypted publications instead of switching contracts', async function() {
        for (const body of [{}, { secret: '' }, { secret: 1 }, delivery, { ...delivery, secret: legacySecret }]) {
          expect((await signed('post', body)).status).to.equal(400);
        }
        expect(update.called).to.equal(false);
      });
    });
  }

  it('serves only the encrypted record belonging to the authenticated recipient', async function() {
    expect((await signed('post', delivery)).status).to.equal(200);
    expect(doc.bwsJoinSecrets).to.deep.equal(delivery.records);
    expect(update.firstCall.args[1]).to.deep.equal({ $set: { bwsJoinSecrets: delivery.records } });
    expect(doc).not.to.have.property('bwsJoinSecret');
    for (const partyId of [1, 2]) {
      const { partyId: ignored, ...record } = delivery.records[partyId - 1];
      const res = await signed('get', {}, partyId);
      expect(res.status).to.equal(200);
      expect(res.body).to.deep.equal(record);
    }
    expect((await signed('get')).status).to.equal(400);
  });

  it('rejects plaintext and mixed publications for the new scheme', async function() {
    for (const body of [{ secret: legacySecret }, { ...delivery, secret: legacySecret }]) {
      expect((await signed('post', body)).status).to.equal(400);
    }
    expect(update.called).to.equal(false);
  });

  it('never returns a plaintext field for the new scheme, even if one is stored', async function() {
    doc.bwsJoinSecret = legacySecret;
    expect((await signed('get', {}, 1)).status).to.equal(400);
    doc.bwsJoinSecrets = delivery.records;
    const res = await signed('get', {}, 1);
    expect(res.status).to.equal(200);
    expect(res.body).not.to.have.property('secret');
    expect(JSON.stringify(res.body)).not.to.contain(legacySecret);
  });

  it('does not overwrite an encrypted delivery through the legacy path', async function() {
    doc.schemeVersion = 1.2;
    doc.bwsJoinSecrets = delivery.records;
    expect((await signed('post', { secret: legacySecret })).status).to.equal(400);
    expect((await signed('get', {}, 1)).body).not.to.have.property('secret');
    expect(update.called).to.equal(false);
  });

  it('rejects callers whose request signature belongs to another participant', async function() {
    const req = signed('get', {}, 1).set('x-identity', participants[2]);
    expect((await req).status).to.equal(401);
  });

});
