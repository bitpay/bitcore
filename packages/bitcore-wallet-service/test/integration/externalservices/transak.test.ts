'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import * as crypto from 'crypto';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

describe('Transak integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;

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

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
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
      server.externalServices.transak.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.transak.transakGetAccessToken(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.transak.transakGetAccessToken(req);
      should.exist(data);
    });

    it('should forward the deviceIp as x-user-ip for web context', async () => {
      let capturedHeaders;
      server.externalServices.transak.request = {
        post: (_url, opts, cb) => {
          capturedHeaders = opts.headers;
          return cb(null, { body: 'data' });
        },
      };
      req.body.context = 'web';
      req.body.deviceIp = '203.0.113.42';
      await server.externalServices.transak.transakGetAccessToken(req);
      capturedHeaders['x-user-ip'].should.equal('203.0.113.42');
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetAccessToken(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
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
        err.message.should.equal('Error');
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
        err.message.should.equal('Error');
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
        err.message.should.equal('Error');
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
          accessToken: 'accessToken1',
          walletAddress: 'walletAddress1',
          redirectURL: 'bitpay://transak',
          fiatAmount: '500',
          fiatCurrency: 'USD',
          network: 'mainnet',
          cryptoCurrencyCode: 'BTC',
          partnerOrderId: 'partnerOrderId1',
          partnerCustomerId: 'partnerCustomerId1',
        }
      };
      server.externalServices.transak.request = fakeRequest;
    });

    it('should get the paymentUrl properly if req is OK', async () => {
      const data = await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      should.exist(data);
    });

    it('should get the paymentUrl properly if req is OK for web', async () => {
      req.body = {
        env: 'production',
        accessToken: 'accessToken1',
        context: 'web',
        walletAddress: 'walletAddress1',
        redirectURL: 'bitpay://transak',
        fiatAmount: '500',
        fiatCurrency: 'USD',
        network: 'mainnet',
        cryptoCurrencyCode: 'BTC',
        partnerOrderId: 'partnerOrderId1',
        partnerCustomerId: 'partnerCustomerId1',
      };
      const data = await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      should.exist(data);
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
      let capturedHeaders;
      server.externalServices.transak.request = {
        post: (_url, opts, cb) => {
          capturedHeaders = opts.headers;
          return cb(null, { body: 'data' });
        },
      };
      req.body.context = 'web';
      req.body.deviceIp = '203.0.113.42';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      capturedHeaders['x-user-ip'].should.equal('203.0.113.42');
    });

    it('should canonicalize an IPv4-mapped IPv6 deviceIp for web context', async () => {
      let capturedHeaders;
      server.externalServices.transak.request = {
        post: (_url, opts, cb) => {
          capturedHeaders = opts.headers;
          return cb(null, { body: 'data' });
        },
      };
      req.body.context = 'web';
      req.body.deviceIp = '::ffff:203.0.113.42';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      capturedHeaders['x-user-ip'].should.equal('203.0.113.42');
    });

    it('should not leak deviceIp into the widgetParams sent to Transak', async () => {
      let capturedBody;
      server.externalServices.transak.request = {
        post: (_url, opts, cb) => {
          capturedBody = opts.body;
          return cb(null, { body: 'data' });
        },
      };
      req.body.context = 'web';
      req.body.deviceIp = '203.0.113.42';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      should.not.exist(capturedBody.widgetParams.deviceIp);
    });

    it('should ignore a body deviceIp for non-web context and use the request IP', async () => {
      let capturedHeaders;
      server.externalServices.transak.request = {
        post: (_url, opts, cb) => {
          capturedHeaders = opts.headers;
          return cb(null, { body: 'data' });
        },
      };
      req.headers['x-forwarded-for'] = '198.51.100.7';
      req.body.deviceIp = '203.0.113.42';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      capturedHeaders['x-user-ip'].should.equal('198.51.100.7');
    });

    it('should fall back to the request IP for web context when deviceIp is not forwarded', async () => {
      let capturedHeaders;
      server.externalServices.transak.request = {
        post: (_url, opts, cb) => {
          capturedHeaders = opts.headers;
          return cb(null, { body: 'data' });
        },
      };
      req.body.context = 'web';
      req.headers['x-forwarded-for'] = '198.51.100.7';
      await server.externalServices.transak.transakGetSignedPaymentUrl(req);
      capturedHeaders['x-user-ip'].should.equal('198.51.100.7');
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
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
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          orderId: 'orderId1',
          accessToken: 'accessToken1',
        }
      };
      server.externalServices.transak.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.transak.transakGetOrderDetails(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.transak.transakGetOrderDetails(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.transak.request = fakeRequest2;
      try {
        await server.externalServices.transak.transakGetOrderDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.orderId;
      try {
        await server.externalServices.transak.transakGetOrderDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak\'s request missing arguments');
      }
    });
  });

  describe('#transakHandleWebhook', () => {
    const accessTokenSecret = 'transakAccessTokenSecret1';
    let body;

    function buildTransakJwt(payload, secret) {
      const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
      const payloadEncoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
      const signingInput = `${header}.${payloadEncoded}`;
      const signature = crypto.createHmac('sha256', secret).update(signingInput).digest('base64url');
      return `${signingInput}.${signature}`;
    }

    function fakeRefreshTokenRequest(secret) {
      return {
        post: (_url, _opts, cb) => cb(null, {
          body: { data: { accessToken: secret, expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 } }
        }),
      };
    }

    beforeEach(() => {
      server.externalServices.transak.request = fakeRefreshTokenRequest(accessTokenSecret);
      const webhookData = {
        id: 'order1',
        status: 'COMPLETED',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:05:00.000Z',
        fiatAmount: 100,
        fiatCurrency: 'USD',
        cryptoAmount: 0.002,
        cryptoCurrency: 'BTC',
        paymentOptionId: 'usd_bank_transfer',
        walletAddress: 'bc1qxyz',
        userId: 'user1'
      };
      body = { data: buildTransakJwt({ webhookData, eventID: 'ORDER_COMPLETED' }, accessTokenSecret) };
      req = { headers: {}, body };
    });

    it('should verify and parse a valid webhook payload', async () => {
      const { event } = await server.externalServices.transak.transakHandleWebhook(req);
      event.partner.should.equal('transak');
      event.externalId.should.equal('order1');
      event.status.should.equal('COMPLETED');
      event.eventName.should.equal('ORDER_COMPLETED');
      event.updatedAt.should.equal('2024-01-01T00:05:00.000Z');
      event.deliveryVersion.should.equal('2024-01-01T00:05:00.000Z');
      event.fiatAmount.should.equal(100);
      event.fiatCurrency.should.equal('USD');
      event.cryptoAmount.should.equal(0.002);
      event.cryptoCurrency.should.equal('BTC');
      event.paymentMethod.should.equal('usd_bank_transfer');
      event.walletAddress.should.equal('bc1qxyz');
      event.userId.should.equal('user1');
      event.env.should.equal('production');
    });

    it('should cache the access token and not call refresh-token again on a second webhook', async () => {
      let callCount = 0;
      server.externalServices.transak.request = {
        post: (_url, _opts, cb) => {
          callCount++;
          return cb(null, { body: { data: { accessToken: accessTokenSecret, expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 } } });
        },
      };
      await server.externalServices.transak.transakHandleWebhook(req);
      const firstCallCount = callCount;
      firstCallCount.should.be.greaterThan(0);
      await server.externalServices.transak.transakHandleWebhook(req);
      callCount.should.equal(firstCallCount);
    });

    it('should throw if the JWT signature does not match', async () => {
      req.body = { data: buildTransakJwt({ webhookData: { id: 'order1' }, eventID: 'ORDER_COMPLETED' }, 'wrongSecret') };
      try {
        await server.externalServices.transak.transakHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak webhook signature verification failed');
      }
    });

    it('should throw if the JWT data field is missing', async () => {
      req.body = {};
      try {
        await server.externalServices.transak.transakHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak webhook missing JWT data field');
      }
    });

    it('should skip verification and still parse if refresh-token fails for both envs', async () => {
      server.externalServices.transak.request = {
        post: (_url, _opts, cb) => cb(new Error('network error'), null),
      };
      const { event } = await server.externalServices.transak.transakHandleWebhook(req);
      should.exist(event);
      event.externalId.should.equal('order1');
    });

    it('should return error if transak is commented in config', async () => {
      config.transak = undefined;
      try {
        await server.externalServices.transak.transakHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak missing credentials');
      }
    });
  });
});