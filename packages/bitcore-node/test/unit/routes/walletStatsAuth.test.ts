import { BitcoreLib as bitcoreLib } from '@bitpay-labs/crypto-wallet-core';
import { expect } from 'chai';
import secp256k1 from 'secp256k1';
import sinon from 'sinon';
import { walletStatsAuth } from '../../../src/routes/walletStatsAuth';
import { Config } from '../../../src/services/config';
import { Auth } from '../../../src/utils/auth';

const MINUTE = 60 * 1000;

function makeKey() {
  const privKey = new bitcoreLib.PrivateKey();
  return {
    priv: privKey.toBuffer(),
    pub: privKey.toPublicKey().toString()
  };
}

function signature(key: { priv: Buffer }, parts: { method: string; originalUrl: string; body: any; timestamp: string }) {
  const message = [parts.method, parts.originalUrl, JSON.stringify(parts.body), parts.timestamp].join('|');
  const hash = bitcoreLib.crypto.Hash.sha256sha256(Buffer.from(message));
  return Buffer.from(secp256k1.ecdsaSign(hash, key.priv).signature).toString('hex');
}

/** Signs req as a consumer would, and returns the timestamp that was signed. */
function authorize(req: any, key: { priv: Buffer }, over: { signedAt?: number; sentAt?: number } = {}) {
  const signedAt = String(over.signedAt ?? Date.now());
  req.headers['x-signature'] = signature(key, { ...req, timestamp: signedAt });
  req.headers['x-timestamp'] = String(over.sentAt ?? signedAt);
  return signedAt;
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
    headers: {},
    setHeader(name: string, value: string) {
      res.headers[name] = value;
    },
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

  describe('gating', () => {
    it('404s without checking the signature when the api is disabled', () => {
      apiConfig.disabled = true;
      const key = makeKey();
      apiConfig.authKeys = [key.pub];
      const verify = sandbox.spy(Auth, 'verifyRequestSignature');
      const { req, res } = makeReqRes();
      authorize(req, key);
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(404);
      expect(verify.called).to.equal(false);
      expect(next.called).to.equal(false);
    });

    it('404s as json, like every other response from these routes', () => {
      apiConfig.disabled = true;
      const { req, res } = makeReqRes();

      walletStatsAuth(req, res, sandbox.stub());

      expect(res.body).to.deep.equal({ error: 'Not found' });
    });

    it('404s when the api config subsection is missing entirely', () => {
      apiConfig = undefined;
      const { req, res } = makeReqRes();
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(404);
      expect(next.called).to.equal(false);
    });
  });

  describe('caching of rejections', () => {
    it('keeps a 404 out of shared caches', () => {
      apiConfig.disabled = true;
      const { req, res } = makeReqRes();

      walletStatsAuth(req, res, sandbox.stub());

      expect(res.headers['Cache-Control']).to.equal('private, max-age=300');
    });

    it('keeps a 401 out of shared caches, so no cdn can replay it at a valid caller', () => {
      apiConfig.authKeys = [makeKey().pub];
      const { req, res } = makeReqRes();

      walletStatsAuth(req, res, sandbox.stub());

      expect(res.statusCode).to.equal(401);
      expect(res.headers['Cache-Control']).to.equal('private, max-age=300');
    });
  });

  describe('signature', () => {
    it('401s on a missing signature without walking the key list', () => {
      apiConfig.authKeys = [makeKey().pub];
      const verify = sandbox.spy(Auth, 'verifyRequestSignature');
      const { req, res } = makeReqRes();
      req.headers['x-timestamp'] = String(Date.now());
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(res.body).to.deep.equal({ error: 'Authentication failed' });
      expect(verify.called).to.equal(false);
      expect(next.called).to.equal(false);
    });

    it('401s when no keys are configured', () => {
      const { req, res } = makeReqRes();
      authorize(req, makeKey());
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('401s when the signature is from an unconfigured key', () => {
      apiConfig.authKeys = [makeKey().pub];
      const { req, res } = makeReqRes();
      authorize(req, makeKey());
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('401s when the signature covers a different url', () => {
      const key = makeKey();
      apiConfig.authKeys = [key.pub];
      const { req, res } = makeReqRes();
      const timestamp = String(Date.now());
      req.headers['x-signature'] = signature(key, {
        ...req,
        originalUrl: '/api/wallet-stats/cohorts',
        timestamp
      });
      req.headers['x-timestamp'] = timestamp;
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('401s on a malformed signature header', () => {
      apiConfig.authKeys = [makeKey().pub];
      const { req, res } = makeReqRes();
      req.headers['x-signature'] = 'not-hex';
      req.headers['x-timestamp'] = String(Date.now());
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('calls next for a signature from the configured key', () => {
      const key = makeKey();
      apiConfig.authKeys = [key.pub];
      const { req, res } = makeReqRes({ originalUrl: '/api/wallet-stats?chain=BTC' });
      authorize(req, key);
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
      authorize(req, second);

      walletStatsAuth(req, res, sandbox.stub());

      expect(res.statusCode).to.equal(null);
    });

    it('keeps a bad key in the list from blocking a good signature', () => {
      const key = makeKey();
      apiConfig.authKeys = ['garbage-pubkey', key.pub];
      const { req, res } = makeReqRes();
      authorize(req, key);
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(next.calledOnce).to.equal(true);
    });
  });

  describe('timestamp', () => {
    let key: { priv: Buffer; pub: string };

    beforeEach(() => {
      key = makeKey();
      apiConfig.authKeys = [key.pub];
    });

    it('401s when the timestamp header is missing', () => {
      const { req, res } = makeReqRes();
      authorize(req, key);
      delete req.headers['x-timestamp'];
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('401s on a non-numeric timestamp', () => {
      const { req, res } = makeReqRes();
      authorize(req, key);
      req.headers['x-timestamp'] = 'yesterday';
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('401s on a replayed request whose timestamp has gone stale', () => {
      const staleAt = Date.now() - 6 * MINUTE;
      const { req, res } = makeReqRes();
      authorize(req, key, { signedAt: staleAt });
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('401s on a timestamp skewed too far into the future', () => {
      const { req, res } = makeReqRes();
      authorize(req, key, { signedAt: Date.now() + 6 * MINUTE });
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('accepts a timestamp inside the tolerance window', () => {
      const { req, res } = makeReqRes();
      authorize(req, key, { signedAt: Date.now() - 4 * MINUTE });
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(next.calledOnce).to.equal(true);
    });

    it('401s when the timestamp header arrives twice', () => {
      const { req, res } = makeReqRes();
      const signedAt = authorize(req, key);
      req.headers['x-timestamp'] = [signedAt, signedAt]; // express hands back an array
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('401s when the signature header arrives twice', () => {
      const { req, res } = makeReqRes();
      authorize(req, key);
      req.headers['x-signature'] = [req.headers['x-signature'], req.headers['x-signature']];
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });

    it('401s when the sent timestamp is not the one that was signed', () => {
      const { req, res } = makeReqRes();
      authorize(req, key, { signedAt: Date.now() - 4 * MINUTE, sentAt: Date.now() });
      const next = sandbox.stub();

      walletStatsAuth(req, res, next);

      expect(res.statusCode).to.equal(401);
      expect(next.called).to.equal(false);
    });
  });
});
