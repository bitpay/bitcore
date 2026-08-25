import { BitcoreLib as bitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { expect } from 'chai';
import secp256k1 from 'secp256k1';
import sinon from 'sinon';
import { walletStatsAuth } from '../../../src/routes/walletStatsAuth';
import { Config } from '../../../src/services/config';

function makeKey() {
  const privKey = new bitcoreLib.PrivateKey();
  return {
    priv: privKey.toBuffer(),
    pub: privKey.toPublicKey().toString()
  };
}

function sign(key: { priv: Buffer }, req: { method: string; originalUrl: string; body: any }) {
  const message = [req.method, req.originalUrl, JSON.stringify(req.body)].join('|');
  const hash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
  return Buffer.from(secp256k1.ecdsaSign(hash, key.priv).signature).toString('hex');
}

function makeReqRes(over: any = {}) {
  const req: any = {
    method: over.method || 'GET',
    originalUrl: over.originalUrl || '/api/wallet-stats',
    body: over.body !== undefined ? over.body : {},
    headers: over.headers || {}
  };
  const res: any = {
    statusCode: null,
    body: null,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(payload: any) {
      res.body = payload;
      return res;
    },
    send(payload: any) {
      res.body = payload;
      return res;
    }
  };
  return { req, res };
}

describe('WalletStats auth middleware', function() {
  const sandbox = sinon.createSandbox();
  let apiConfig: any;

  beforeEach(() => {
    apiConfig = { disabled: false, authKeys: [] };
    sandbox.stub(Config, 'for').callsFake((service: any) => {
      return service === 'walletStats' ? ({ api: apiConfig } as any) : ({} as any);
    });
  });
  afterEach(() => sandbox.restore());

  it('404s without checking the signature when the api is disabled', () => {
    apiConfig.disabled = true;
    const key = makeKey();
    apiConfig.authKeys = [key.pub];
    const { req, res } = makeReqRes();
    req.headers['x-signature'] = sign(key, req);
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(res.statusCode).to.equal(404);
    expect(next.called).to.equal(false);
  });

  it('404s when the api config subsection is missing entirely', () => {
    apiConfig = undefined;
    const { req, res } = makeReqRes();
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(res.statusCode).to.equal(404);
    expect(next.called).to.equal(false);
  });

  it('401s when no signature header is present', () => {
    apiConfig.authKeys = [makeKey().pub];
    const { req, res } = makeReqRes();
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(res.statusCode).to.equal(401);
    expect(res.body).to.deep.equal({ error: 'Authentication failed' });
    expect(next.called).to.equal(false);
  });

  it('401s when no keys are configured', () => {
    const key = makeKey();
    const { req, res } = makeReqRes();
    req.headers['x-signature'] = sign(key, req);
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(res.statusCode).to.equal(401);
    expect(next.called).to.equal(false);
  });

  it('401s when the signature is from an unconfigured key', () => {
    apiConfig.authKeys = [makeKey().pub];
    const { req, res } = makeReqRes();
    req.headers['x-signature'] = sign(makeKey(), req);
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(res.statusCode).to.equal(401);
    expect(next.called).to.equal(false);
  });

  it('401s when the signature covers a different url', () => {
    const key = makeKey();
    apiConfig.authKeys = [key.pub];
    const { req, res } = makeReqRes();
    req.headers['x-signature'] = sign(key, { ...req, originalUrl: '/api/wallet-stats/cohorts' });
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(res.statusCode).to.equal(401);
    expect(next.called).to.equal(false);
  });

  it('401s on a malformed signature header', () => {
    apiConfig.authKeys = [makeKey().pub];
    const { req, res } = makeReqRes();
    req.headers['x-signature'] = 'not-hex';
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(res.statusCode).to.equal(401);
    expect(next.called).to.equal(false);
  });

  it('calls next for a signature from the configured key', () => {
    const key = makeKey();
    apiConfig.authKeys = [key.pub];
    const { req, res } = makeReqRes({ originalUrl: '/api/wallet-stats?chain=BTC' });
    req.headers['x-signature'] = sign(key, req);
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(next.calledOnce).to.equal(true);
    expect(res.statusCode).to.equal(null);
  });

  it('accepts a signature from any configured key, not just the first', () => {
    const first = makeKey();
    const second = makeKey();
    apiConfig.authKeys = [first.pub, second.pub];
    const { req, res } = makeReqRes();
    req.headers['x-signature'] = sign(second, req);
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(next.calledOnce).to.equal(true);
  });

  it('keeps a bad key in the list from blocking a good signature', () => {
    const key = makeKey();
    apiConfig.authKeys = ['garbage-pubkey', key.pub];
    const { req, res } = makeReqRes();
    req.headers['x-signature'] = sign(key, req);
    const next = sandbox.stub();

    walletStatsAuth(req, res, next);

    expect(next.calledOnce).to.equal(true);
  });
});
