'use strict';

import * as chai from 'chai';
import * as crypto from 'crypto';
import * as sinon from 'sinon';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import { TransakService } from '../../../src/externalservices/transak';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';
import logger from '../../../src/lib/logger';

const should = chai.should();

const PARTNER_TOKEN = 'partnerToken1';

// The body bitpay-app sends to signedPaymentUrl, minus env/accessToken.
const appWidgetBody = () => ({
  walletAddress: 'walletAddress1',
  disableWalletAddressForm: true,
  redirectURL: 'bitpay://transak',
  exchangeScreenTitle: 'Bitpay - Buy crypto',
  fiatAmount: '500',
  fiatCurrency: 'USD',
  network: 'mainnet',
  cryptoCurrencyCode: 'BTC',
  cryptoCurrencyList: 'BTC',
  hideExchangeScreen: true,
  themeColor: '2240C4',
  hideMenu: false,
  partnerOrderId: 'partnerOrderId1',
  partnerCustomerId: 'partnerCustomerId1',
  paymentMethod: 'credit_debit_card',
});

describe('Transak integration', () => {
  const sandbox = sinon.createSandbox();
  let server;
  let wallet;
  let fakeRequest;
  let req;
  let loggerError: sinon.SinonStub;

  // Fake Transak state, reset before each test.
  let refreshCalls: { url: string; opts: any }[];
  let sessionCalls: { url: string; opts: any }[];
  let orderCalls: { url: string; opts: any }[];
  let tokens: string[];
  let tokenExpiresAt: number | undefined;
  let refreshStatus: number;
  let refreshDelay: number;
  let sessionStatuses: number[];
  let sessionError: Error | null;
  let sessionErrorBody: any;
  let orderStatuses: number[];
  let orderError: Error | null;
  let orderBody: any;

  const newReq = (env: string, extra = {}) => ({ headers: {}, body: { env, ...appWidgetBody(), ...extra } });
  const partnerTokenId = (env: string, apiKey: string) =>
    `${env}:${crypto.createHash('sha256').update(apiKey).digest('hex').slice(0, 12)}`;
  const updatePartnerTokenCache = (update: any) =>
    server.storage.db.collection('cache').updateMany({ key: { $regex: '^transakPartnerToken:' } }, update);

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.transak = {
      sandbox: {
        api: 'api1',
        apiKey: 'apiKey1',
        secretKey: 'secretKey1',
        widgetApi: 'widgetApi1',
      },
      production: {
        api: 'api2',
        apiKey: 'apiKey2',
        secretKey: 'secretKey2',
        widgetApi: 'widgetApi2',
      },
      sandboxWeb: {
        api: 'api3',
        apiKey: 'apiKey3',
        secretKey: 'secretKey3',
        widgetApi: 'widgetApi3',
      },
      productionWeb: {
        api: 'api4',
        apiKey: 'apiKey4',
        secretKey: 'secretKey4',
        widgetApi: 'widgetApi4',
      }
    };

    refreshCalls = [];
    sessionCalls = [];
    orderCalls = [];
    tokens = [PARTNER_TOKEN];
    tokenExpiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
    refreshStatus = 200;
    refreshDelay = 0;
    sessionStatuses = [];
    sessionError = null;
    sessionErrorBody = { error: { message: 'unauthorized' } };
    orderStatuses = [];
    orderError = null;
    orderBody = 'data';

    fakeRequest = {
      get: (url, opts, cb) => {
        if (url.includes('/partners/api/v2/order/')) {
          orderCalls.push({ url, opts });
          if (orderError) return cb(orderError, null);
          return cb(null, { statusCode: orderStatuses.shift() ?? 200, body: orderBody });
        }
        return cb(null, { body: 'data' });
      },
      post: (url, opts, cb) => {
        if (url.endsWith('/partners/api/v2/refresh-token')) {
          refreshCalls.push({ url, opts });
          const accessToken = tokens.length > 1 ? tokens.shift() : tokens[0];
          const respond = () => cb(null, {
            statusCode: refreshStatus,
            body: refreshStatus === 200 ? { data: { accessToken, expiresAt: tokenExpiresAt } } : { error: 'unauthorized' }
          });
          return refreshDelay ? setTimeout(respond, refreshDelay) : respond();
        }
        if (url.endsWith('/api/v2/auth/session')) {
          sessionCalls.push({ url, opts });
          if (sessionError) return cb(sessionError, null);
          const statusCode = sessionStatuses.shift() ?? 200;
          return cb(null, {
            statusCode,
            body: statusCode === 200 ? { data: { widgetUrl: 'https://global.transak.com/?session=abc' } } : sessionErrorBody
          });
        }
        return cb(null, { body: 'data' });
      },
    };

    await helpers.beforeEach();
    ({ wallet } = await helpers.createAndJoinWallet(1, 1));
    const priv = TestData.copayers[0].privKey_1H_0;
    const sig = helpers.signMessage('hello world', priv);

    (server = await util.promisify(WalletService.getInstanceWithAuth).call(WalletService, {
      // test assumes wallet's copayer[0] is TestData's copayer[0]
      copayerId: wallet.copayers[0].id,
      message: 'hello world',
      signature: sig,
      clientVersion: 'bwc-2.0.0',
      walletId: '123',
    }));
    sandbox.stub(logger, 'warn');
    loggerError = sandbox.stub(logger, 'error');
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(async () => {
    await helpers.after();
  });

  describe('#transakGetAccessToken', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      };
      server.externalServices.transak.request = {
        get: () => { throw new Error('should not call Transak'); },
        post: () => { throw new Error('should not call Transak'); },
      };
    });

    it('should return a placeholder without calling Transak', async () => {
      const data = await server.externalServices.transak.transakGetAccessToken(req);
      data.data.accessToken.should.equal('server-managed');
    });

    it('should return a placeholder for web without calling Transak', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.transak.transakGetAccessToken(req);
      data.data.accessToken.should.equal('server-managed');
    });

    it('should return an integer expiresAt in seconds in the future', async () => {
      const now = Math.floor(Date.now() / 1000);
      const { data } = await server.externalServices.transak.transakGetAccessToken(req);
      Number.isInteger(data.expiresAt).should.equal(true);
      data.expiresAt.should.be.above(now);
      data.expiresAt.should.be.at.most(now + 2 * 60 + 1);
    });

    it('should return error if transak is commented in config', async () => {
      config.transak = undefined;

      try {
        await server.externalServices.transak.transakGetAccessToken(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak missing credentials');
      }
    });
  });

  describe('#transakGetCryptoCurrencies', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      };
      server.externalServices.transak.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.transak.transakGetCryptoCurrencies(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.transak.transakGetCryptoCurrencies(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetCryptoCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Transak request failed with error (');
        err.message.should.equal('Failed to get Transak supported currencies');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetCryptoCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak did not return supported currencies');
      }
    });

    it('should return error if transak is commented in config', async () => {
      config.transak = undefined;

      try {
        await server.externalServices.transak.transakGetCryptoCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak missing credentials');
      }
    });
  });

  describe('#transakGetFiatCurrencies', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      };
      server.externalServices.transak.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.transak.transakGetFiatCurrencies(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.transak.transakGetFiatCurrencies(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetFiatCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Transak request failed with error (');
        err.message.should.equal('Failed to get Transak supported fiat currencies');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetFiatCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak did not return supported fiat currencies');
      }
    });

    it('should return error if transak is commented in config', async () => {
      config.transak = undefined;

      try {
        await server.externalServices.transak.transakGetFiatCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak missing credentials');
      }
    });
  });

  describe('#transakGetQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          fiatCurrency: 'USD',
          cryptoCurrency: 'BTC',
          network: 'mainnet',
          paymentMethod: 'credit_debit_card'
        }
      };
      server.externalServices.transak.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.transak.transakGetQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.transak.transakGetQuote(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Transak request failed with error (');
        err.message.should.equal('Failed to get Transak quote');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak did not return a quote');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.fiatCurrency;
      try {
        await server.externalServices.transak.transakGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak\'s request missing arguments');
      }
    });

    it('should return error if transak is commented in config', async () => {
      config.transak = undefined;

      try {
        await server.externalServices.transak.transakGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak missing credentials');
      }
    });
  });

  describe('#transakGetSignedPaymentUrl', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'production',
          accessToken: 'clientSuppliedToken',
          ...appWidgetBody(),
        }
      };
      server.externalServices.transak.request = fakeRequest;
    });

    it('should get the paymentUrl properly if req is OK', async () => {
      const data = await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      data.urlWithSignature.should.equal('https://global.transak.com/?session=abc');
    });

    it('should get the paymentUrl properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      data.urlWithSignature.should.equal('https://global.transak.com/?session=abc');
    });

    it('should work for web with only the fields bitpay.com sends and no accessToken', async () => {
      req.body = {
        env: 'production',
        context: 'web',
        walletAddress: 'walletAddress1',
        redirectURL: 'https://bitpay.com/buy-crypto',
        fiatAmount: '500',
        fiatCurrency: 'USD',
        defaultNetwork: 'bitcoin',
        cryptoCurrencyCode: 'BTC',
        deviceIp: '203.0.113.42',
      };
      const data = await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
    });

    it('should work for the app without an accessToken', async () => {
      delete req.body.accessToken;
      const data = await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
    });

    it('should use the server-side partner token and ignore any client accessToken', async () => {
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      sessionCalls.length.should.equal(1);
      sessionCalls[0].opts.headers['access-token'].should.equal(PARTNER_TOKEN);
      refreshCalls[0].opts.headers['api-secret'].should.equal('secretKey2');
    });

    it('should only send allowlisted fields in widgetParams', async () => {
      req.body.context = 'web';
      req.body.deviceIp = '203.0.113.42';
      req.body.somethingElse = 'nope';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      const widgetParams = sessionCalls[0].opts.body.widgetParams;
      should.not.exist(widgetParams.accessToken);
      should.not.exist(widgetParams.env);
      should.not.exist(widgetParams.context);
      should.not.exist(widgetParams.deviceIp);
      should.not.exist(widgetParams.somethingElse);
      JSON.stringify(sessionCalls[0].opts.body).should.not.contain(PARTNER_TOKEN);
      JSON.stringify(sessionCalls[0].opts.body).should.not.contain('clientSuppliedToken');
      widgetParams.should.deep.equal({
        ...appWidgetBody(),
        apiKey: 'apiKey4',
        referrerDomain: 'bitpay.com',
      });
    });

    it('should refresh the partner token once and reuse it across requests and instances', async () => {
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await server.externalServices.transak.transakGetSignedPaymentUrl({ headers: {}, body: { env: 'production', ...appWidgetBody() } });

      const otherInstance = new TransakService(server.storage, server.lock);
      otherInstance.request = fakeRequest;
      await otherInstance.transakGetSignedPaymentUrl({ headers: {}, body: { env: 'production', ...appWidgetBody() } });

      refreshCalls.length.should.equal(1);
      sessionCalls.length.should.equal(3);
    });

    it('should refresh only once for concurrent requests', async () => {
      refreshDelay = 100;
      await Promise.all([1, 2, 3, 4, 5].map(() => {
        const instance = new TransakService(server.storage, server.lock);
        instance.request = fakeRequest;
        return instance.transakGetSignedPaymentUrl({ headers: {}, body: { env: 'production', ...appWidgetBody() } });
      }));
      refreshCalls.length.should.equal(1);
      sessionCalls.length.should.equal(5);
    });

    it('should keep a separate partner token per environment', async () => {
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await server.externalServices.transak.transakGetSignedPaymentUrl({ headers: {}, body: { env: 'production', context: 'web', ...appWidgetBody() } });
      await server.externalServices.transak.transakGetSignedPaymentUrl({ headers: {}, body: { env: 'sandbox', ...appWidgetBody() } });
      refreshCalls.length.should.equal(3);
      refreshCalls.map(c => c.opts.headers['x-api-key']).should.deep.equal(['apiKey2', 'apiKey4', 'apiKey1']);
    });

    it('should refresh the partner token when it is close to expiring', async () => {
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await updatePartnerTokenCache({ $set: { 'result.expiresAt': Date.now() + 5 * 60 * 1000 } });
      await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      refreshCalls.length.should.equal(2);
    });

    it('should use a fallback TTL when Transak returns expiresAt as a duration', async () => {
      tokenExpiresAt = 7 * 24 * 60 * 60;
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      refreshCalls.length.should.equal(1);
    });

    it('should use a fallback TTL when Transak omits expiresAt', async () => {
      tokenExpiresAt = undefined;
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      refreshCalls.length.should.equal(1);
    });

    it('should accept expiresAt in milliseconds', async () => {
      tokenExpiresAt = Date.now() + 7 * 24 * 60 * 60 * 1000;
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      refreshCalls.length.should.equal(1);
    });

    it('should not reuse a token cached for a rotated API key', async () => {
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      config.transak.production.apiKey = 'apiKey2-rotated';
      tokens = ['rotatedToken'];
      await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      refreshCalls.length.should.equal(2);
      refreshCalls[1].opts.headers['x-api-key'].should.equal('apiKey2-rotated');
      sessionCalls[1].opts.headers['access-token'].should.equal('rotatedToken');
    });

    it('should refresh and retry once when Transak rejects an older partner token', async () => {
      tokens = ['staleToken', 'freshToken'];
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await updatePartnerTokenCache({ $set: { 'result.fetchedAt': Date.now() - 60 * 60 * 1000 } });
      sessionStatuses = [401, 200];
      const data = await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      should.exist(data.urlWithSignature);
      refreshCalls.length.should.equal(2);
      sessionCalls.map(c => c.opts.headers['access-token']).should.deep.equal(['staleToken', 'staleToken', 'freshToken']);
    });

    it('should fail rather than return an empty URL on repeated 401s', async () => {
      tokens = ['token1', 'token2', 'token3'];
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await updatePartnerTokenCache({ $set: { 'result.fetchedAt': Date.now() - 60 * 60 * 1000 } });
      sessionStatuses = [401, 401, 401];
      try {
        await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Failed to get Transak signed payment URL');
      }
      sessionCalls.length.should.equal(3);
      refreshCalls.length.should.equal(2);
    });

    it('should not refresh when Transak rejects a token it just issued', async () => {
      sessionStatuses = [401, 401, 401, 401, 401];
      for (let i = 0; i < 5; i++) {
        try {
          await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
          should.fail('should have thrown');
        } catch (err) {
          err.message.should.equal('Transak rejected the access token');
        }
      }
      refreshCalls.length.should.equal(1);
      sessionCalls.length.should.equal(5);
    });

    it('should fail if Transak does not return a widget URL', async () => {
      sessionStatuses = [500];
      try {
        await server.externalServices.transak.transakGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Failed to get Transak signed payment URL');
      }
    });

    it('should fail without refreshing when another request holds the refresh lock too long', async () => {
      const release: any = await util.promisify((cb) =>
        server.lock.acquire(`transakPartnerToken:${partnerTokenId('production', 'apiKey2')}`, { lockTime: 60000 }, cb)
      )();
      const transak = server.externalServices.transak;
      transak.partnerTokenLockWait = 200;
      try {
        await transak.transakGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Failed to get Transak access token');
      } finally {
        release();
      }
      refreshCalls.length.should.equal(0);
    });

    it('should check the failure backoff before waiting on the refresh lock', async () => {
      refreshStatus = 401;
      await server.externalServices.transak.transakGetSignedPaymentUrl(req).catch(() => {});
      const release: any = await util.promisify((cb) =>
        server.lock.acquire(`transakPartnerToken:${partnerTokenId('production', 'apiKey2')}`, { lockTime: 60000 }, cb)
      )();
      const started = Date.now();
      try {
        await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Failed to get Transak access token');
      } finally {
        release();
      }
      (Date.now() - started).should.be.below(1000);
      refreshCalls.length.should.equal(1);
    });

    it('should retry the refresh once the failure backoff has passed', async () => {
      refreshStatus = 401;
      await server.externalServices.transak.transakGetSignedPaymentUrl(req).catch(() => {});
      await server.storage.db.collection('cache').updateMany(
        { key: { $regex: '^transakPartnerTokenFailure:' } },
        { $set: { ts: Date.now() - 31 * 1000 } }
      );
      refreshStatus = 200;
      const data = await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      should.exist(data.urlWithSignature);
      refreshCalls.length.should.equal(2);
    });

    it('should keep serving a still-valid token when the proactive refresh fails', async () => {
      tokens = ['currentToken'];
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await updatePartnerTokenCache({ $set: { 'result.expiresAt': Date.now() + 5 * 60 * 1000 } });
      refreshStatus = 500;
      await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      refreshCalls.length.should.equal(2);
      sessionCalls.map(c => c.opts.headers['access-token']).should.deep.equal(['currentToken', 'currentToken', 'currentToken']);
    });

    it('should keep serving a still-valid token when the refresh lock is held too long', async () => {
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await updatePartnerTokenCache({ $set: { 'result.expiresAt': Date.now() + 5 * 60 * 1000 } });
      const release: any = await util.promisify((cb) =>
        server.lock.acquire(`transakPartnerToken:${partnerTokenId('production', 'apiKey2')}`, { lockTime: 60000 }, cb)
      )();
      const transak = server.externalServices.transak;
      transak.partnerTokenLockWait = 200;
      try {
        await transak.transakGetSignedPaymentUrl(newReq('production'));
      } finally {
        release();
      }
      refreshCalls.length.should.equal(1);
      sessionCalls[1].opts.headers['access-token'].should.equal(PARTNER_TOKEN);
    });

    it('should not serve a token past its real expiry when the refresh fails', async () => {
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await updatePartnerTokenCache({ $set: { 'result.expiresAt': Date.now() + 10 * 1000 } });
      refreshStatus = 500;
      try {
        await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak did not return an access token');
      }
      sessionCalls.length.should.equal(1);
    });

    it('should refresh and retry once when Transak answers 403 for an older token', async () => {
      tokens = ['staleToken', 'freshToken'];
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      await updatePartnerTokenCache({ $set: { 'result.fetchedAt': Date.now() - 60 * 60 * 1000 } });
      sessionStatuses = [403, 200];
      await server.externalServices.transak.transakGetSignedPaymentUrl(newReq('production'));
      sessionCalls.map(c => c.opts.headers['access-token']).should.deep.equal(['staleToken', 'staleToken', 'freshToken']);
    });

    it('should log Transak\'s error message but not the token', async () => {
      const loggerWarn = logger.warn as sinon.SinonStub;
      sessionStatuses = [500];
      await server.externalServices.transak.transakGetSignedPaymentUrl(req).catch(() => null);
      const logged = loggerWarn.args.map(a => String(a[0])).join('\n');
      logged.should.contain('(unauthorized)');
      logged.should.not.contain(PARTNER_TOKEN);
    });

    it('should log a non-string Transak error message as JSON', async () => {
      const loggerWarn = logger.warn as sinon.SinonStub;
      sessionStatuses = [400];
      sessionErrorBody = { error: { message: { code: 'INVALID_PARAMS', fields: ['fiatAmount'] } } };
      await server.externalServices.transak.transakGetSignedPaymentUrl(req).catch(() => null);
      const logged = loggerWarn.args.map(a => String(a[0])).join('\n');
      logged.should.contain('({"code":"INVALID_PARAMS","fields":["fiatAmount"]})');
    });

    it('should log no detail when Transak sends no error message', async () => {
      const loggerWarn = logger.warn as sinon.SinonStub;
      sessionStatuses = [502];
      sessionErrorBody = 'Bad Gateway';
      const err = await server.externalServices.transak.transakGetSignedPaymentUrl(req).catch(e => e);
      err.message.should.equal('Failed to get Transak signed payment URL');
      loggerWarn.args.map(a => String(a[0])).join('\n').should.match(/status code 502: \S+$/m);
    });

    it('should forward defaultPaymentMethod when the app sends it instead of paymentMethod', async () => {
      delete req.body.paymentMethod;
      req.body.defaultPaymentMethod = 'credit_debit_card';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      sessionCalls[0].opts.body.widgetParams.defaultPaymentMethod.should.equal('credit_debit_card');
      should.not.exist(sessionCalls[0].opts.body.widgetParams.paymentMethod);
    });

    it('should fail and back off when the partner token refresh fails', async () => {
      refreshStatus = 401;
      for (let i = 0; i < 3; i++) {
        try {
          await server.externalServices.transak.transakGetSignedPaymentUrl({ headers: {}, body: { env: 'production', ...appWidgetBody() } });
          should.fail('should have thrown');
        } catch (err) {
          err.message.should.match(/Transak did not return an access token|Failed to get Transak access token/);
        }
      }
      refreshCalls.length.should.equal(1);
      sessionCalls.length.should.equal(0);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.context;
      delete req.body.fiatAmount;

      try {
        await server.externalServices.transak.transakGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak\'s request missing arguments');
      }
    });

    it('should forward the deviceIp as x-user-ip for web context', async () => {
      req.body.context = 'web';
      req.body.deviceIp = '203.0.113.42';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      sessionCalls[0].opts.headers['x-user-ip'].should.equal('203.0.113.42');
      refreshCalls[0].opts.headers['x-user-ip'].should.equal('203.0.113.42');
    });

    it('should canonicalize an IPv4-mapped IPv6 deviceIp for web context', async () => {
      req.body.context = 'web';
      req.body.deviceIp = '::ffff:203.0.113.42';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      sessionCalls[0].opts.headers['x-user-ip'].should.equal('203.0.113.42');
    });

    it('should ignore a body deviceIp for non-web context and use the request IP', async () => {
      req.headers['x-forwarded-for'] = '198.51.100.7';
      req.body.deviceIp = '203.0.113.42';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      sessionCalls[0].opts.headers['x-user-ip'].should.equal('198.51.100.7');
    });

    it('should fall back to the request IP for web context when deviceIp is not forwarded', async () => {
      req.body.context = 'web';
      req.headers['x-forwarded-for'] = '198.51.100.7';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      sessionCalls[0].opts.headers['x-user-ip'].should.equal('198.51.100.7');
    });

    it('should return error if post returns error', async () => {
      sessionError = new Error('Error');
      try {
        await server.externalServices.transak.transakGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Transak request failed with error (');
        err.message.should.equal('Failed to get Transak signed payment URL');
      }
    });

    it('should return error if transak is commented in config', async () => {
      config.transak = undefined;

      try {
        await server.externalServices.transak.transakGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak missing credentials');
      }
    });
  });

  describe('#transakGetOrderDetails', () => {
    let ownedAddress: string;

    beforeEach(async () => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          orderId: '6f1d2c3b-1a2b-4c5d-8e9f-0a1b2c3d4e5f',
        }
      };
      server.externalServices.transak.request = fakeRequest;
      ownedAddress = (await util.promisify(server.createAddress).call(server, {})).address;
      orderBody = { data: { walletAddress: ownedAddress, status: 'PROCESSING' } };
    });

    it('should return an order for an address of the requesting wallet', async () => {
      const data = await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      data.should.deep.equal({ data: { walletAddress: ownedAddress, status: 'PROCESSING' } });
    });

    it('should not return another wallet\'s order', async () => {
      const { server: otherServer } = await helpers.createAndJoinWallet(1, 1, { offset: 1 });
      const otherAddress = (await util.promisify(otherServer.createAddress).call(otherServer, {})).address;
      orderBody = { data: { walletAddress: otherAddress, status: 'PROCESSING' } };
      try {
        await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak order not found');
      }
      // The owner can still read it.
      otherServer.externalServices.transak.request = fakeRequest;
      const data = await otherServer.externalServices.transak.transakGetOrderDetails({ headers: {}, body: { ...req.body } }, otherServer.walletId);
      data.data.walletAddress.should.equal(otherAddress);
    });

    it('should not return an order without a wallet address', async () => {
      orderBody = { data: { status: 'PROCESSING' } };
      try {
        await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak order not found');
      }
    });

    it('should not return an order without a requesting wallet', async () => {
      try {
        await server.externalServices.transak.transakGetOrderDetails(req, undefined);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak order not found');
      }
    });

    it('should match an EVM order address in any case', async () => {
      const { server: ethServer } = await helpers.createAndJoinWallet(1, 1, { coin: 'eth', offset: 1 });
      ethServer.externalServices.transak.request = fakeRequest;
      const ethAddress = (await util.promisify(ethServer.createAddress).call(ethServer, {})).address;
      ethAddress.should.not.equal(ethAddress.toLowerCase());
      for (const walletAddress of [ethAddress.toLowerCase(), ethAddress.toUpperCase().replace('0X', '0x')]) {
        orderBody = { data: { walletAddress, status: 'PROCESSING' } };
        const data = await ethServer.externalServices.transak.transakGetOrderDetails({ headers: {}, body: { ...req.body } }, ethServer.walletId);
        data.data.walletAddress.should.equal(walletAddress);
      }
    });

    it('should pass through a Transak error without an ownership check', async () => {
      orderStatuses = [400];
      orderBody = { error: { statusCode: 400, message: 'Invalid orderId' } };
      const data = await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      data.should.deep.equal({ error: { statusCode: 400, message: 'Invalid orderId' } });
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      should.exist(data);
    });

    it('should use the server-side partner token and ignore any client accessToken', async () => {
      req.body.accessToken = 'clientSuppliedToken';
      await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      orderCalls.length.should.equal(1);
      orderCalls[0].url.should.equal('api1/partners/api/v2/order/6f1d2c3b-1a2b-4c5d-8e9f-0a1b2c3d4e5f');
      orderCalls[0].opts.headers['access-token'].should.equal(PARTNER_TOKEN);
    });

    it('should forward the deviceIp as x-user-ip for web context', async () => {
      req.body.context = 'web';
      req.body.deviceIp = '203.0.113.42';
      req.headers['x-forwarded-for'] = '198.51.100.7';
      await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      orderCalls[0].opts.headers['x-user-ip'].should.equal('203.0.113.42');
    });

    it('should ignore a body deviceIp for non-web context and use the request IP', async () => {
      req.body.deviceIp = '203.0.113.42';
      req.headers['x-forwarded-for'] = '198.51.100.7';
      await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      orderCalls[0].opts.headers['x-user-ip'].should.equal('198.51.100.7');
    });

    it('should share the partner token with signedPaymentUrl', async () => {
      await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      await server.externalServices.transak.transakGetSignedPaymentUrl({ headers: {}, body: { env: 'sandbox', ...appWidgetBody() } });
      refreshCalls.length.should.equal(1);
    });

    it('should refresh and retry once when Transak rejects an older partner token', async () => {
      tokens = ['staleToken', 'freshToken'];
      await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
      await updatePartnerTokenCache({ $set: { 'result.fetchedAt': Date.now() - 60 * 60 * 1000 } });
      orderStatuses = [401, 200];
      await server.externalServices.transak.transakGetOrderDetails({ headers: {}, body: { ...req.body } }, server.walletId);
      orderCalls.map(c => c.opts.headers['access-token']).should.deep.equal(['staleToken', 'staleToken', 'freshToken']);
    });

    for (const orderId of ['../orders', '../orders?limit=100', 'abc/def', 'abc?x=1', 'a#b', '', 'a'.repeat(65)]) {
      it(`should reject orderId ${JSON.stringify(orderId)} without calling Transak`, async () => {
        req.body.orderId = orderId;
        try {
          await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
          should.fail('should have thrown');
        } catch (err) {
          err.message.should.match(/Invalid Transak orderId|Transak's request missing arguments/);
        }
        orderCalls.length.should.equal(0);
        refreshCalls.length.should.equal(0);
      });
    }

    it('should return error if get returns error', async () => {
      orderError = new Error('Error');
      try {
        await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Transak request failed with error (');
        err.message.should.equal('Failed to get Transak order details');
      };
    });

    it('should return error and not leak the response if body is empty', async () => {
      orderBody = undefined;
      try {
        await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak did not return order details');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.orderId;
      try {
        await server.externalServices.transak.transakGetOrderDetails(req, server.walletId);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak\'s request missing arguments');
      }
    });
  });
});
