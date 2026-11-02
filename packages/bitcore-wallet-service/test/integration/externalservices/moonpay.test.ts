'use strict';

import * as chai from 'chai';
import * as sinon from 'sinon';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';
import logger from '../../../src/lib/logger';

const should = chai.should();

describe('Moonpay integration', () => {
  const sandbox = sinon.createSandbox();
  let server;
  let wallet;
  let fakeRequest;
  let req;
  let loggerError: sinon.SinonStub;

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
    sandbox.stub(logger, 'warn');
    loggerError = sandbox.stub(logger, 'error');
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(async () => {
    await helpers.after();
  });

  describe('#moonpayGetCurrencies', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox'
        }
      };
      server.externalServices.moonpay.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.moonpay.moonpayGetCurrencies(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to get Moonpay currencies');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay did not return currencies');
      }
    });

    it('should return error if moonpay is commented in config', async () => {
      config.moonpay = undefined;
      try {
        await server.externalServices.moonpay.moonpayGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay missing credentials');
      }
    });
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to get Moonpay buy quote');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay did not return buy quote');
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to get Moonpay sell quote');
      };
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay did not return sell quote');
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to get Moonpay currency limits');
      };
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetCurrencyLimits(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay did not return currency limits');
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to get Moonpay transaction details');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay did not return transaction details');
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to get Moonpay sell transaction details');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetSellTransactionDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay did not return sell transaction details');
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to get Moonpay account details');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayGetAccountDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay did not return account details');
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

    it('should return the response body if there is one', async () => {
      const data = await server.externalServices.moonpay.moonpayCancelSellTransaction(req);
      data.should.equal('data');
    });

    it('should return success true without leaking the response if there is no body', async () => {
      const fakeRequest2 = {
        delete: (_url, opts, _cb) => {
          return _cb(null, { statusCode: 204, body: undefined, headers: {}, request: { headers: opts.headers } });
        },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      const data = await server.externalServices.moonpay.moonpayCancelSellTransaction(req);
      data.should.deep.equal({ success: true });
    });

    it('should return success false if there is no body and status is not 2xx', async () => {
      const fakeRequest2 = {
        delete: (_url, opts, _cb) => {
          return _cb(null, { statusCode: 404, body: '', headers: {}, request: { headers: opts.headers } });
        },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      const data = await server.externalServices.moonpay.moonpayCancelSellTransaction(req);
      data.should.deep.equal({ success: false });
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to cancel Moonpay sell transaction');
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

    it('should return the response body if there is one', async () => {
      const data = await server.externalServices.moonpay.moonpayCreateSession(req);
      data.should.equal('data');
    });

    it('should throw without leaking the response if there is no session body', async () => {
      const fakeRequest2 = {
        post: (_url, opts, _cb) => {
          return _cb(null, { statusCode: 200, body: undefined, headers: {}, request: { headers: opts.headers } });
        },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      try {
        await server.externalServices.moonpay.moonpayCreateSession(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay did not return a session');
      }
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to create Moonpay session');
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

    it('should return the response body if there is one', async () => {
      const data = await server.externalServices.moonpay.moonpayRevokeActiveSession(req);
      data.should.equal('data');
    });

    it('should return success true without leaking the response if there is no body', async () => {
      const fakeRequest2 = {
        delete: (_url, opts, _cb) => {
          return _cb(null, { statusCode: 204, body: undefined, headers: {}, request: { headers: opts.headers } });
        },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      const data = await server.externalServices.moonpay.moonpayRevokeActiveSession(req);
      data.should.deep.equal({ success: true });
    });

    it('should return success false if there is no body and status is not 2xx', async () => {
      const fakeRequest2 = {
        delete: (_url, opts, _cb) => {
          return _cb(null, { statusCode: 404, body: '', headers: {}, request: { headers: opts.headers } });
        },
      };

      server.externalServices.moonpay.request = fakeRequest2;
      const data = await server.externalServices.moonpay.moonpayRevokeActiveSession(req);
      data.should.deep.equal({ success: false });
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
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay request failed with error (');
        err.message.should.equal('Failed to revoke Moonpay session');
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
});
