'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js').default;
let server, wallet, fakeRequest, req;

  describe('Banxa integration', () => {
    before((done) => {
      helpers.before((res) => {
        done();
      });
    });
    beforeEach((done) => {
      config.banxa = {
        sandbox: {
          api: 'api1',
          apiKey: 'apiKey1',
          secretKey: 'secretKey1',
        },
        production: {
          api: 'api2',
          apiKey: 'apiKey2',
          secretKey: 'secretKey2',
        },
        sandboxWeb: {
          api: 'api3',
          apiKey: 'apiKey3',
          secretKey: 'secretKey3',
        },
        productionWeb: {
          api: 'api4',
          apiKey: 'apiKey4',
          secretKey: 'secretKey4',
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

    describe('#banxaGetPaymentMethods', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox',
          }
        }
      server.externalServices.banxa.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.banxa.banxaGetPaymentMethods(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.banxa.banxaGetPaymentMethods(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.banxa.request = fakeRequest2;
        try {
          const data = await server.externalServices.banxa.banxaGetPaymentMethods(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if banxa is commented in config', async () => {
        config.banxa = undefined;

        try {
          const data = await server.externalServices.banxa.banxaGetPaymentMethods(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Banxa missing credentials');
        }
      });
    });

    describe('#banxaGetCoins', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox',
            orderType: 'buy'
          }
        }
      server.externalServices.banxa.request = fakeRequest;
      });

      it('should work properly if req is OK for buy', async () => {
        try {
          const data = await server.externalServices.banxa.banxaGetCoins(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for sell', async () => {
        try {
          req.body.orderType = 'sell'
          const data = await server.externalServices.banxa.banxaGetCoins(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.banxa.banxaGetCoins(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.banxa.request = fakeRequest2;
        try {
          const data = await server.externalServices.banxa.banxaGetCoins(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if orderType is not buy or sell', async () => {
        try {
          req.body.orderType = 'wrongOrderType';
          const data = await server.externalServices.banxa.banxaGetCoins(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal(`Banxa's 'orderType' property must be 'sell' or 'buy'`);
        }
      });

      it('should return error if orderType is not present', async () => {
        try {
          delete req.body.orderType;
          const data = await server.externalServices.banxa.banxaGetCoins(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal(`Banxa's request missing arguments`);
        }
      });

      it('should return error if banxa is commented in config', async () => {
        config.banxa = undefined;

        try {
          const data = await server.externalServices.banxa.banxaGetCoins(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Banxa missing credentials');
        }
      });
    });

    describe('#banxaGetQuote', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox',
            source: 'USD',
            target: 'BTC'
          }
        }
        server.externalServices.banxa.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.banxa.banxaGetQuote(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.banxa.banxaGetQuote(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.banxa.request = fakeRequest2;
        try {
          const data = await server.externalServices.banxa.banxaGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.target;
        try {
          const data = await server.externalServices.banxa.banxaGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Banxa\'s request missing arguments');
        }
      });

      it('should return error if banxa is commented in config', async () => {
        config.banxa = undefined;

        try {
          const data = await server.externalServices.banxa.banxaGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Banxa missing credentials');
        }
      });
    });

    describe('#banxaCreateOrder', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox',
            account_reference: 'account_reference1',
            source: 'USD',
            target: 'BTC',
            wallet_address: 'wallet_address1',
            return_url_on_success: 'return_url_on_success1'
          }
        }
        server.externalServices.banxa.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.banxa.banxaCreateOrder(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.banxa.banxaCreateOrder(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if post returns error', async () => {
        const fakeRequest2 = {
          post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.banxa.request = fakeRequest2;
        try {
          const data = await server.externalServices.banxa.banxaCreateOrder(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.source;
        try {
          const data = await server.externalServices.banxa.banxaCreateOrder(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Banxa\'s request missing arguments');
        }
      });

      it('should return error if banxa is commented in config', async () => {
        config.banxa = undefined;

        try {
          const data = await server.externalServices.banxa.banxaCreateOrder(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Banxa missing credentials');
        }
      });
    });

    describe('#banxaGetOrder', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox',
            order_id: 'order_id1',
          }
        }
        server.externalServices.banxa.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.banxa.banxaGetOrder(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.banxa.banxaGetOrder(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.banxa.request = fakeRequest2;
        try {
          const data = await server.externalServices.banxa.banxaGetOrder(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.order_id;
        try {
          const data = await server.externalServices.banxa.banxaGetOrder(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Banxa\'s request missing arguments');
        }
      });

      it('should return error if banxa is commented in config', async () => {
        config.banxa = undefined;

        try {
          const data = await server.externalServices.banxa.banxaGetOrder(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Banxa missing credentials');
        }
      });
    });
  });