import { BitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { expect } from 'chai';
import sinon from 'sinon';
import { Utils } from '../src/lib/common/utils';
import logger from '../src/lib/logger';
import { WalletService } from '../src/lib/server';
import { authRequest } from '../src/lib/routes/middleware/authRequest';
import { authTssKeyGenRequest, authTssSignRequest } from '../src/lib/routes/middleware/authTssRequest';

describe('Auth middleware error handling', function() {
  const sandbox = sinon.createSandbox();
  const key = new BitcoreLib.PrivateKey();
  const pubKey = key.publicKey.toString();
  const url = '/v1/tss/test/session';
  let storage: any;
  let next: sinon.SinonStub;
  let res: any;
  let logError: sinon.SinonStub;

  function makeReq(body: any = {}, identity = 'copayer1') {
    const signature = BitcoreLib.crypto.ECDSA.sign(
      Utils.hashMessage('post|' + url + '|' + JSON.stringify(body), false), key, { endian: 'little' }
    ).toString();
    const headers = { 'x-identity': identity, 'x-signature': signature };
    return { method: 'POST', url, body, params: { id: 'session' }, header: (name: string) => headers[name] } as any;
  }

  function makeRes() {
    const r: any = { headersSent: false };
    r.status = sandbox.stub().callsFake(code => { r.statusCode = code; return r; });
    r.json = sandbox.stub().callsFake(body => { r.body = body; return r; });
    r.end = sandbox.stub().returns(r);
    return r;
  }

  const round0 = () => ({ message: { round: 0, partyId: 0, publicKey: pubKey } });

  beforeEach(function() {
    storage = {
      fetchTssKeyGenSession: sandbox.stub().resolves(null),
      fetchTssSigSession: sandbox.stub().resolves(null),
      fetchCopayerLookup: sandbox.stub().resolves({ requestPubKeys: [{ key: pubKey }] })
    };
    sandbox.stub(WalletService, 'getStorage').returns(storage);
    next = sandbox.stub();
    logError = sandbox.stub(logger, 'error');
    res = makeRes();
  });

  afterEach(function() {
    sandbox.restore();
  });

  const middlewares: [string, () => any, () => void][] = [
    ['authTssKeyGenRequest', () => authTssKeyGenRequest(), () => storage.fetchTssKeyGenSession.rejects(new Error('db down'))],
    ['authTssSignRequest', () => authTssSignRequest(), () => storage.fetchTssSigSession.rejects(new Error('db down'))],
    ['authRequest', () => authRequest(), () => storage.fetchCopayerLookup.rejects(new Error('db down'))]
  ];

  for (const [name, build, breakStorage] of middlewares) {
    describe(name, function() {
      it('calls next() for a valid request', async function() {
        const req = makeReq(round0());
        await build()(req, res, next);
        expect(next.calledOnce).to.equal(true);
        expect(res.status.called).to.equal(false);
      });

      it('returns a ClientError as-is', async function() {
        const req = makeReq(round0(), '');
        req.header = () => undefined; // no credentials
        await build()(req, res, next);
        expect(next.called).to.equal(false);
        expect(res.statusCode).to.equal(401);
        expect(res.body).to.deep.equal({ code: 'NOT_AUTHORIZED', message: 'Not authorized' });
      });

      it('returns an unexpected error as a generic INTERNAL_ERROR bad request', async function() {
        breakStorage();
        await build()(makeReq(round0()), res, next);
        expect(next.called).to.equal(false);
        expect(res.statusCode).to.equal(400);
        expect(res.body).to.deep.equal({ code: 'INTERNAL_ERROR', message: 'Internal error' });
      });

      it('does not leak the original error to the client', async function() {
        breakStorage();
        await build()(makeReq(round0()), res, next);
        expect(JSON.stringify(res.body)).to.not.include('db down');
      });

      it('logs the original error and the request url once', async function() {
        breakStorage();
        await build()(makeReq(round0()), res, next);
        expect(logError.calledOnce).to.equal(true);
        const msg = logError.firstCall.args[0];
        expect(msg).to.include(url);
        expect(msg).to.include('Error: db down');
        expect(msg).to.include('authmiddleware.test'); // stack frame
      });

      it('logs a thrown non-Error value', async function() {
        for (const f of [storage.fetchTssKeyGenSession, storage.fetchTssSigSession, storage.fetchCopayerLookup]) f.callsFake(async () => { throw 'boom'; });
        await build()(makeReq(round0()), res, next);
        expect(res.body.code).to.equal('INTERNAL_ERROR');
        expect(logError.firstCall.args[0]).to.include(': boom');
      });

      it('logs the contents of a thrown non-Error object', async function() {
        for (const f of [storage.fetchTssKeyGenSession, storage.fetchTssSigSession, storage.fetchCopayerLookup]) f.callsFake(async () => { throw { code: 'E_OBJ', detail: { reason: 'nested' } }; });
        await build()(makeReq(round0()), res, next);
        expect(res.body.code).to.equal('INTERNAL_ERROR');
        const msg = logError.firstCall.args[0];
        expect(msg).to.not.include('[object Object]');
        expect(msg).to.include('E_OBJ');
        expect(msg).to.include('nested');
      });

      it('does not log client errors at error level', async function() {
        const req = makeReq(round0());
        req.header = () => undefined;
        await build()(req, res, next);
        expect(logError.called).to.equal(false);
      });
    });
  }
});
