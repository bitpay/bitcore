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

describe('Sardine integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;

  before(async () => {
    await helpers.before();
  });
  
  beforeEach(async () => {
    config.sardine = {
      sandbox: {
        api: 'api1',
        secretKey: 'secretKey1',
        clientId: 'clientId1',
      },
      production: {
        api: 'api2',
        secretKey: 'secretKey2',
        clientId: 'clientId2',
      },
      sandboxWeb: {
        api: 'api3',
        secretKey: 'secretKey3',
        clientId: 'clientId3',
      },
      productionWeb: {
        api: 'api4',
        secretKey: 'secretKey4',
        clientId: 'clientId4',
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

  describe('#sardineGetQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          asset_type: 'BTC',
          network: 'bitcoin',
          total: 50,
          currency: 'USD',
          paymentType: 'debit',
          quote_type: 'buy'
        }
      };
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.sardine.sardineGetQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetQuote(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.asset_type;
      try {
        await server.externalServices.sardine.sardineGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine\'s request missing arguments');
      }
    });

    it('should return error if sardine is commented in config', async () => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineGetCurrencyLimits', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      };
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.sardine.sardineGetCurrencyLimits(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetCurrencyLimits(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetCurrencyLimits(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if sardine is commented in config', async () => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetCurrencyLimits(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineGetToken', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          referenceId: 'referenceId1',
          externalUserId: 'externalUserId1',
          customerId: 'customerId1',
        }
      };
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.sardine.sardineGetToken(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetToken(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetToken(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.referenceId;
      try {
        await server.externalServices.sardine.sardineGetToken(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine\'s request missing arguments');
      }
    });

    it('should return error if sardine is commented in config', async () => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetToken(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineGetSupportedTokens', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      };
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async() => {
      const data = await server.externalServices.sardine.sardineGetSupportedTokens(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async() => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetSupportedTokens(req);
      should.exist(data);
    });

    it('should return error if get returns error', async() => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetSupportedTokens(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if sardine is commented in config', async() => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetSupportedTokens(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineGetOrdersDetails', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          orderId: 'orderId1',
        }
      };
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetOrdersDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.orderId;
      try {
        await server.externalServices.sardine.sardineGetOrdersDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine\'s request missing arguments');
      }
    });

    it('should work properly if orderId is not present but externalUserId is', async () => {
      delete req.body.orderId;
      req.body.externalUserId = 'externalUserId1';
      const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
      should.exist(data);
    });

    it('should return error if sardine is commented in config', async () => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetOrdersDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineHandleWebhook', () => {
    const webhookSecret = 'sardineWebhookSecret1';
    let body;

    beforeEach(() => {
      config.sardine.production.webhookSecret = webhookSecret;
      body = {
        eventType: 'processed',
        order: {
          id: 'order1',
          status: 'Processed',
          createdAt: '2024-01-01T00:00:00.000Z',
          fiatCurrency: 'USD',
          total: 100,
          assetType: 'BTC',
          userId: 'user1'
        }
      };
      req = { headers: {}, body };
    });

    it('should verify and parse a valid webhook payload', () => {
      const rawBody = JSON.stringify(body);
      const sig = crypto.createHmac('sha256', webhookSecret).update(rawBody).digest('hex');
      req.headers['x-sardine-signature'] = sig;
      const { event } = server.externalServices.sardine.sardineHandleWebhook(req);
      event.partner.should.equal('sardine');
      event.externalId.should.equal('order1');
      event.status.should.equal('Processed');
      event.eventName.should.equal('processed');
      event.fiatAmount.should.equal(100);
      event.fiatCurrency.should.equal('USD');
      event.cryptoCurrency.should.equal('BTC');
      event.userId.should.equal('user1');
      event.env.should.equal('production');
    });

    it('should parse a flat (non-nested) payload when there is no order wrapper', () => {
      delete config.sardine.production.webhookSecret;
      req.body = {
        id: 'order2',
        status: 'complete',
        createdAt: '2024-01-02T00:00:00.000Z',
        fiatCurrency: 'EUR',
        total: 50,
        cryptoCurrency: 'ETH',
        externalUserId: 'user2'
      };
      const { event } = server.externalServices.sardine.sardineHandleWebhook(req);
      event.externalId.should.equal('order2');
      event.fiatCurrency.should.equal('EUR');
      event.cryptoCurrency.should.equal('ETH');
      event.userId.should.equal('user2');
    });

    it('should throw if the signature does not match', () => {
      const rawBody = JSON.stringify(body);
      const sig = crypto.createHmac('sha256', 'wrongSecret').update(rawBody).digest('hex');
      req.headers['x-sardine-signature'] = sig;
      try {
        server.externalServices.sardine.sardineHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine webhook signature verification failed');
      }
    });

    it('should not throw and skip verification if the signature header is missing, even with a secret configured', () => {
      const { event } = server.externalServices.sardine.sardineHandleWebhook(req);
      event.externalId.should.equal('order1');
    });

    it('should not throw and skip verification if no webhookSecret is configured', () => {
      delete config.sardine.production.webhookSecret;
      req.headers['x-sardine-signature'] = 'some-signature';
      const { event } = server.externalServices.sardine.sardineHandleWebhook(req);
      event.externalId.should.equal('order1');
    });

    it('should return error if sardine is commented in config', () => {
      config.sardine = undefined;
      try {
        server.externalServices.sardine.sardineHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });
});