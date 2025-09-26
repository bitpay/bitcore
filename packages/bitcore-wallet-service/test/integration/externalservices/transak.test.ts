'use strict';

import chai from 'chai';
import 'chai/register-should';
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
    }

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }) },
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }) },
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
      }
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

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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
      }
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
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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
      }
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
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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
      }
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
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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
          walletAddress: 'walletAddress1',
          redirectURL: 'bitpay://transak',
          fiatAmount: '500',
          fiatCurrency: 'USD',
          network: 'mainnet',
          cryptoCurrencyCode: 'BTC',
          partnerOrderId: 'partnerOrderId1',
          partnerCustomerId: 'partnerCustomerId1',
        }
      }
      server.externalServices.transak.request = fakeRequest;
    });

    it('should get the paymentUrl properly if req is OK', () => {
      const data = server.externalServices.transak.transakGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi2?apiKey=apiKey2&walletAddress=walletAddress1&redirectURL=bitpay%3A%2F%2Ftransak&fiatAmount=500&fiatCurrency=USD&network=mainnet&cryptoCurrencyCode=BTC&partnerOrderId=partnerOrderId1&partnerCustomerId=partnerCustomerId1');
    });

    it('should get the paymentUrl properly if req is OK for web', () => {
      req.body = {
        env: 'production',
        context: 'web',
        walletAddress: 'walletAddress1',
        redirectURL: 'bitpay://transak',
        fiatAmount: '500',
        fiatCurrency: 'USD',
        network: 'mainnet',
        cryptoCurrencyCode: 'BTC',
        partnerOrderId: 'partnerOrderId1',
        partnerCustomerId: 'partnerCustomerId1',
      }
      const data = server.externalServices.transak.transakGetSignedPaymentUrl(req);
      should.exist(data.urlWithSignature);
      data.urlWithSignature.should.equal('widgetApi4?apiKey=apiKey4&walletAddress=walletAddress1&redirectURL=bitpay%3A%2F%2Ftransak&fiatAmount=500&fiatCurrency=USD&network=mainnet&cryptoCurrencyCode=BTC&partnerOrderId=partnerOrderId1&partnerCustomerId=partnerCustomerId1');
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.context;
      delete req.body.fiatAmount;

      try {
        server.externalServices.transak.transakGetSignedPaymentUrl(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Transak\'s request missing arguments');
      }
    });

    it('should return error if transak is commented in config', () => {
      config.transak = undefined;

      try {
        server.externalServices.transak.transakGetSignedPaymentUrl(req);
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
      }
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
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
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
});