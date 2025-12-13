'use strict';

import * as chai from 'chai';
import 'chai/register-should';
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
        headers: {},
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
      data.urlWithSignature.should.equal('widgetApi2?apiKey=apiKey2&currencyCode=btc&walletAddress=bitcoin%3A123123&baseCurrencyCode=usd&baseCurrencyAmount=500&externalTransactionId=123123&redirectURL=bitpay%3A%2F%2Fmoonpay&signature=%2FDnbsboySgE%2FeAvMrwzROCLuuctkhgw5C2t2OofjOzo%3D');
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
});
