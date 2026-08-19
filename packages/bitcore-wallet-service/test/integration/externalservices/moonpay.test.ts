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

describe('Moonpay integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.moonpay = {
      sandbox: {
        apiKey: 'apiKey1',
        api: 'api1',
        widgetApi: 'widgetApi1',
        sellWidgetApi: 'sellWidgetApi1',
        secretKey: 'secretKey1'
      },
      production: {
        apiKey: 'apiKey2',
        api: 'api2',
        widgetApi: 'widgetApi2',
        sellWidgetApi: 'sellWidgetApi2',
        secretKey: 'secretKey2'
      },
      sandboxWeb: {
        apiKey: 'apiKey3',
        api: 'api3',
        widgetApi: 'widgetApi3',
        sellWidgetApi: 'sellWidgetApi3',
        secretKey: 'secretKey3'
      },
      productionWeb: {
        apiKey: 'apiKey4',
        api: 'api4',
        widgetApi: 'widgetApi4',
        sellWidgetApi: 'sellWidgetApi4',
        secretKey: 'secretKey4'
      }
    };

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
      delete: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
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

  describe('#moonpayGetQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          currencyAbbreviation: 'btc',
          baseCurrencyAmount: 50,
          extraFeePercentage: 5,
          baseCurrencyCode: 'usd'
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.moonpay.moonpayGetQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.moonpay.moonpayGetQuote(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.baseCurrencyAmount;
      try {
        await server.externalServices.moonpay.moonpayGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayGetSellQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          currencyAbbreviation: 'btc',
          quoteCurrencyCode: 'usd',
          baseCurrencyAmount: 1
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.moonpay.moonpayGetSellQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.moonpay.moonpayGetSellQuote(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.baseCurrencyAmount;
      try {
        await server.externalServices.moonpay.moonpayGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayGetCurrencyLimits', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          currencyAbbreviation: 'btc',
          baseCurrencyCode: 'usd'
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.moonpay.moonpayGetCurrencyLimits(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.moonpay.moonpayGetCurrencyLimits(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetCurrencyLimits(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.baseCurrencyCode;
      try {
        await server.externalServices.moonpay.moonpayGetCurrencyLimits(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayGetCurrencyLimits(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayGetSignedPaymentUrl', () => {
    beforeEach(() => {
      req = {
        headers: {
          'x-forwarded-for': '1.2.3.4'
        },
        body: {
          env: 'production',
          currencyCode: 'btc',
          walletAddress: 'bitcoin:123123',
          baseCurrencyCode: 'usd',
          baseCurrencyAmount: '500',
          externalTransactionId: '123123',
          redirectURL: 'bitpay://moonpay'
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should get the paymentUrl properly if req is OK', () => {
      const data = server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi2?apiKey=apiKey2&currencyCode=btc&walletAddress=bitcoin%3A123123&baseCurrencyCode=usd&baseCurrencyAmount=500&externalTransactionId=123123&redirectURL=bitpay%3A%2F%2Fmoonpay&allowedIpAddress=CN35SFB5PKS4vkiZ4CglTxRgTAaUHBLGZcenAw6gHEY%3D&signature=3XxjRX3EMj2RNaoAwgOwFBOiVTXsgAS7C50uJf9SsvM%3D');
    });

    it('should return error if request does not have IP', () => {
      delete req.headers['x-forwarded-for'];
      try {
        server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Could not determine device IP address');
      }
    });

    it('should hash the forwarded deviceIp instead of the request IP for web context', () => {
      req.body.context = 'web';
      req.body.deviceIp = '203.0.113.42';
      const data = server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi4?apiKey=apiKey4&currencyCode=btc&walletAddress=bitcoin%3A123123&baseCurrencyCode=usd&baseCurrencyAmount=500&externalTransactionId=123123&redirectURL=bitpay%3A%2F%2Fmoonpay&allowedIpAddress=HkPyqsZMUzAgsEx27Tlz%2B5XfZHaH0fSfWV%2FMKR7JAPc%3D&signature=B%2Bw0TTQiy8%2Ffq6QeoeSf4dKpdPHZ%2F2EnBB1S4UotNGM%3D');
    });

    it('should canonicalize IPv4-mapped IPv6 deviceIp before hashing', () => {
      req.body.context = 'web';
      req.body.deviceIp = '::ffff:203.0.113.42';
      const data = server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi4?apiKey=apiKey4&currencyCode=btc&walletAddress=bitcoin%3A123123&baseCurrencyCode=usd&baseCurrencyAmount=500&externalTransactionId=123123&redirectURL=bitpay%3A%2F%2Fmoonpay&allowedIpAddress=HkPyqsZMUzAgsEx27Tlz%2B5XfZHaH0fSfWV%2FMKR7JAPc%3D&signature=B%2Bw0TTQiy8%2Ffq6QeoeSf4dKpdPHZ%2F2EnBB1S4UotNGM%3D');
    });

    it('should omit allowedIpAddress for web context when no deviceIp is forwarded', () => {
      req.body.context = 'web';
      const data = server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi4?apiKey=apiKey4&currencyCode=btc&walletAddress=bitcoin%3A123123&baseCurrencyCode=usd&baseCurrencyAmount=500&externalTransactionId=123123&redirectURL=bitpay%3A%2F%2Fmoonpay&signature=13Q%2BET1UQLnCqCyg3stDAN4%2FTQ8QB009LcuAP1y6B%2FI%3D');
    });

    it('should ignore a body deviceIp for non-web context and use the request IP', () => {
      req.body.deviceIp = '203.0.113.42';
      const data = server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi2?apiKey=apiKey2&currencyCode=btc&walletAddress=bitcoin%3A123123&baseCurrencyCode=usd&baseCurrencyAmount=500&externalTransactionId=123123&redirectURL=bitpay%3A%2F%2Fmoonpay&allowedIpAddress=CN35SFB5PKS4vkiZ4CglTxRgTAaUHBLGZcenAw6gHEY%3D&signature=3XxjRX3EMj2RNaoAwgOwFBOiVTXsgAS7C50uJf9SsvM%3D');
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.currencyCode;
      try {
        server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', () => {
      config.moonpay = undefined;
      try {
        server.externalServices.moonpay.moonpayGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayGetSellSignedPaymentUrl', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'production',
          baseCurrencyCode: 'btc',
          baseCurrencyAmount: 500,
          externalTransactionId: '123123',
          redirectURL: 'bitpay://moonpay',
          quoteCurrencyCode: 'usd',
          refundWalletAddress: 'bitcoin:123123',
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should get the paymentUrl properly if req is OK', () => {
      const data = server.externalServices.moonpay.moonpayGetSellSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('sellWidgetApi2?apiKey=apiKey2&baseCurrencyCode=btc&baseCurrencyAmount=500&externalTransactionId=123123&redirectURL=bitpay%3A%2F%2Fmoonpay&quoteCurrencyCode=usd&refundWalletAddress=bitcoin%3A123123&signature=otiVaKVxKT%2BRNOfkSMOk07U3JxY4DrpPAztiXl5Wvjc%3D');
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.baseCurrencyCode;

      try {
        server.externalServices.moonpay.moonpayGetSellSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', () => {
      config.moonpay = undefined;
      try {
        server.externalServices.moonpay.moonpayGetSellSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayGetTransactionDetails', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          transactionId: 'transactionId1',
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK with transactionId', async () => {
      const data = await server.externalServices.moonpay.moonpayGetTransactionDetails(req);
      should.exist(data);
    });

    it('should work properly if req is OK with externalId', async () => {
      delete req.body.transactionId;
      req.body.externalId = 'externalId1';
      const data = await server.externalServices.moonpay.moonpayGetTransactionDetails(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is no transactionId or externalId', async () => {
      delete req.body.transactionId;
      delete req.body.externalId;
      try {
        await server.externalServices.moonpay.moonpayGetTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayGetTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayGetSellTransactionDetails', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          transactionId: 'transactionId1',
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK with transactionId', async () => {
      const data = await server.externalServices.moonpay.moonpayGetSellTransactionDetails(req);
      should.exist(data);
    });

    it('should work properly if req is OK with externalId', async () => {
      delete req.body.transactionId;
      req.body.externalId = 'externalId1';
      const data = await server.externalServices.moonpay.moonpayGetSellTransactionDetails(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetSellTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is no transactionId or externalId', async () => {
      delete req.body.transactionId;
      delete req.body.externalId;
      try {
        await server.externalServices.moonpay.moonpayGetSellTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayGetSellTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayGetAccountDetails', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.moonpay.moonpayGetAccountDetails(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetAccountDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayGetAccountDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayCancelSellTransaction', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          transactionId: 'transactionId1',
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK with transactionId', async () => {
      const data = await server.externalServices.moonpay.moonpayCancelSellTransaction(req);
      should.exist(data);
    });

    it('should work properly if req is OK with externalId', async () => {
      delete req.body.transactionId;
      req.body.externalId = 'externalId1';
      const data = await server.externalServices.moonpay.moonpayCancelSellTransaction(req);
      should.exist(data);
    });

    it('should return error if delete returns error', async () => {
      const fakeRequest2 = {
        delete: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayCancelSellTransaction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is no transactionId or externalId', async () => {
      delete req.body.transactionId;
      delete req.body.externalId;
      try {
        await server.externalServices.moonpay.moonpayCancelSellTransaction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayCancelSellTransaction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayCreateSession', () => {
    beforeEach(() => {
      req = {
        headers: {
          'x-forwarded-for': '192.168.1.1'
        },
        body: {
          env: 'sandbox',
          externalCustomerId: 'externalCustomerId1'
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.moonpay.moonpayCreateSession(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.moonpay.moonpayCreateSession(req);
      should.exist(data);
    });

    it('should work properly with optional email and phoneNumber', async () => {
      req.body.email = 'user@example.com';
      req.body.phoneNumber = '+14155551234';
      const data = await server.externalServices.moonpay.moonpayCreateSession(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayCreateSession(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.externalCustomerId;
      try {
        await server.externalServices.moonpay.moonpayCreateSession(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if device IP cannot be determined', async () => {
      req.headers = {};
      delete req.ip;
      delete req.connection;
      try {
        await server.externalServices.moonpay.moonpayCreateSession(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Could not determine device IP address');
      }
    });

    it('should extract IP from x-forwarded-for header', async () => {
      req.headers = { 'x-forwarded-for': '10.0.0.1, 10.0.0.2' };
      let capturedBody;
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => {
          capturedBody = _opts.body;
          return _cb(null, { body: { sessionToken: 'token123' } });
        },
      };
      server.externalServices.moonpay.request = fakeRequest2;
      await server.externalServices.moonpay.moonpayCreateSession(req);
      capturedBody.deviceIp.should.equal('10.0.0.1');
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayCreateSession(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayRevokeActiveSession', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          externalCustomerId: 'externalCustomerId1'
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      await server.externalServices.moonpay.moonpayRevokeActiveSession(req);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      await server.externalServices.moonpay.moonpayRevokeActiveSession(req);
    });

    it('should return error if delete returns error', async () => {
      const fakeRequest2 = {
        delete: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayRevokeActiveSession(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.externalCustomerId;
      try {
        await server.externalServices.moonpay.moonpayRevokeActiveSession(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay\'s request missing arguments');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayRevokeActiveSession(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
  });

  describe('#moonpayHandleWebhook', () => {
    const webhookSecret = 'moonpayWebhookSecret1';
    let body;

    function moonpaySignatureHeader(secret, ts, rawBody) {
      const sig = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
      return `t=${ts},s=${sig}`;
    }

    beforeEach(() => {
      config.moonpay.production.webhookSecretKey = webhookSecret;
      body = {
        type: 'transaction_updated',
        externalCustomerId: 'user1',
        data: {
          id: 'tx1',
          status: 'completed',
          createdAt: '2024-01-01T00:00:00.000Z',
          updatedAt: '2024-01-01T00:05:00.000Z',
          baseCurrencyAmount: 100,
          baseCurrency: { code: 'usd' },
          quoteCurrencyAmount: 0.002,
          currency: { code: 'btc' },
          paymentMethod: 'credit_debit_card',
          walletAddress: 'bc1qxyz',
          walletAddressTag: 'tag1',
          externalCustomerId: 'user1'
        }
      };
      req = { headers: {}, body };
    });

    it('should verify and parse a valid webhook payload', () => {
      const ts = Date.now();
      req.headers['moonpay-signature-v2'] = moonpaySignatureHeader(webhookSecret, ts, JSON.stringify(body));
      const { event } = server.externalServices.moonpay.moonpayHandleWebhook(req);
      event.partner.should.equal('moonpay');
      event.externalId.should.equal('tx1');
      event.status.should.equal('completed');
      event.eventName.should.equal('transaction_updated');
      event.updatedAt.should.equal('2024-01-01T00:05:00.000Z');
      event.deliveryVersion.should.equal('2024-01-01T00:05:00.000Z');
      event.fiatAmount.should.equal(100);
      event.fiatCurrency.should.equal('USD');
      event.cryptoAmount.should.equal(0.002);
      event.cryptoCurrency.should.equal('BTC');
      event.walletAddress.should.equal('bc1qxyz');
      event.walletAddressTag.should.equal('tag1');
      event.userId.should.equal('user1');
      event.env.should.equal('production');
      event.isEmbedded.should.equal(false);
    });

    it('should mark the event as embedded when verified with the embedded secret', () => {
      const embeddedSecret = 'moonpayEmbeddedSecret1';
      config.moonpay.production.webhookSecretKeyEmbedded = embeddedSecret;
      const ts = Date.now();
      req.headers['moonpay-signature-v2'] = moonpaySignatureHeader(embeddedSecret, ts, JSON.stringify(body));
      const { event } = server.externalServices.moonpay.moonpayHandleWebhook(req);
      event.isEmbedded.should.equal(true);
    });

    it('should throw if the signature does not match', () => {
      const ts = Date.now();
      req.headers['moonpay-signature-v2'] = moonpaySignatureHeader('wrongSecret', ts, JSON.stringify(body));
      try {
        server.externalServices.moonpay.moonpayHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('MoonPay webhook signature verification failed');
      }
    });

    it('should throw if the signature header is missing while a secret is configured', () => {
      try {
        server.externalServices.moonpay.moonpayHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('MoonPay webhook missing Moonpay-Signature-V2 header');
      }
    });

    it('should skip verification and still parse if no webhookSecretKey is configured', () => {
      delete config.moonpay.production.webhookSecretKey;
      const { event } = server.externalServices.moonpay.moonpayHandleWebhook(req);
      event.externalId.should.equal('tx1');
    });

    it('should throw if event type is missing', () => {
      delete config.moonpay.production.webhookSecretKey;
      delete req.body.type;
      try {
        server.externalServices.moonpay.moonpayHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('MoonPay webhook missing event type');
      }
    });

    it('should throw if transaction id is missing', () => {
      delete config.moonpay.production.webhookSecretKey;
      delete req.body.data.id;
      try {
        server.externalServices.moonpay.moonpayHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('MoonPay webhook missing transaction id');
      }
    });

    it('should throw if updatedAt is missing or invalid', () => {
      delete config.moonpay.production.webhookSecretKey;
      req.body.data.updatedAt = 'not-a-date';
      try {
        server.externalServices.moonpay.moonpayHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('MoonPay webhook missing valid updatedAt');
      }
    });

    it('should return error if moonpay is commented in config', () => {
      config.moonpay = undefined;
      try {
        server.externalServices.moonpay.moonpayHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('MoonPay missing credentials');
      }
    });
  });
});
