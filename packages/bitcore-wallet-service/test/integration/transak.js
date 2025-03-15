'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js').default;
let server, wallet, fakeRequest, req;

  describe('Transak integration', () => {
    before((done) => {
      helpers.before((res) => {
        done();
      });
    });
    beforeEach((done) => {
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

      helpers.beforeEach((res) => {
        helpers.createAndJoinWallet(1, 1, (s, w) => {
          wallet = w;
          const priv = TestData.copayers[0].privKey_1H_0;
          const sig = helpers.signMessage('hello world', priv);
    
          WalletService.getInstanceWithAuth({
            // test assumes wallet's copayer[0] is TestData's copayer[0]
            copayerId: wallet.copayers[0].id,
            message: 'hello world',
            signature: sig,
            clientVersion: 'bwc-2.0.0',
            walletId: '123',
          }, (err, s) => {
            should.not.exist(err);
            server = s;
            done();
          });
        });
      });
    });
    after((done) => {
      helpers.after(done);
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
        try {
          const data = await server.externalServices.transak.transakGetAccessToken(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.transak.transakGetAccessToken(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if post returns error', async () => {
        const fakeRequest2 = {
          post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.transak.request = fakeRequest2;
        try {
          const data = await server.externalServices.transak.transakGetAccessToken(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if transak is commented in config', async () => {
        config.transak = undefined;

        try {
          const data = await server.externalServices.transak.transakGetAccessToken(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        try {
          const data = await server.externalServices.transak.transakGetCryptoCurrencies(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.transak.transakGetCryptoCurrencies(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.transak.request = fakeRequest2;
        try {
          const data = await server.externalServices.transak.transakGetCryptoCurrencies(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if transak is commented in config', async () => {
        config.transak = undefined;

        try {
          const data = await server.externalServices.transak.transakGetCryptoCurrencies(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        try {
          const data = await server.externalServices.transak.transakGetFiatCurrencies(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.transak.transakGetFiatCurrencies(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.transak.request = fakeRequest2;
        try {
          const data = await server.externalServices.transak.transakGetFiatCurrencies(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if transak is commented in config', async () => {
        config.transak = undefined;

        try {
          const data = await server.externalServices.transak.transakGetFiatCurrencies(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        try {
          const data = await server.externalServices.transak.transakGetQuote(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.transak.transakGetQuote(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.transak.request = fakeRequest2;
        try {
          const data = await server.externalServices.transak.transakGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.fiatCurrency;
        try {
          const data = await server.externalServices.transak.transakGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Transak\'s request missing arguments');
        }
      });

      it('should return error if transak is commented in config', async () => {
        config.transak = undefined;

        try {
          const data = await server.externalServices.transak.transakGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        try {
          const data = server.externalServices.transak.transakGetSignedPaymentUrl(req);
          should.exist(data.urlWithSignature);
          data.urlWithSignature.should.equal('widgetApi2?apiKey=apiKey2&walletAddress=walletAddress1&redirectURL=bitpay%3A%2F%2Ftransak&fiatAmount=500&fiatCurrency=USD&network=mainnet&cryptoCurrencyCode=BTC&partnerOrderId=partnerOrderId1&partnerCustomerId=partnerCustomerId1');
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should get the paymentUrl properly if req is OK for web', () => {
        try {
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
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if there is some missing arguments', () => {
        delete req.body.context;
        delete req.body.fiatAmount;

        try {
          const data = server.externalServices.transak.transakGetSignedPaymentUrl(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Transak\'s request missing arguments');
        }
      });

      it('should return error if transak is commented in config', () => {
        config.transak = undefined;

        try {
          const data = server.externalServices.transak.transakGetSignedPaymentUrl(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        try {
          const data = await server.externalServices.transak.transakGetOrderDetails(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.transak.transakGetOrderDetails(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.transak.request = fakeRequest2;
        try {
          const data = await server.externalServices.transak.transakGetOrderDetails(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.orderId;
        try {
          const data = await server.externalServices.transak.transakGetOrderDetails(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Transak\'s request missing arguments');
        }
      });
    });
  });