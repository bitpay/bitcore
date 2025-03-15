'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js').default;
let server, wallet, fakeRequest, req;

  describe('Sardine integration', () => {
    before((done) => {
      helpers.before((res) => {
        done();
      });
    });
    beforeEach((done) => {
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
        }
        server.externalServices.sardine.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.sardine.sardineGetQuote(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.sardine.sardineGetQuote(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.sardine.request = fakeRequest2;
        try {
          const data = await server.externalServices.sardine.sardineGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.asset_type;
        try {
          const data = await server.externalServices.sardine.sardineGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Sardine\'s request missing arguments');
        }
      });

      it('should return error if sardine is commented in config', async () => {
        config.sardine = undefined;

        try {
          const data = await server.externalServices.sardine.sardineGetQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        }
        server.externalServices.sardine.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.sardine.sardineGetCurrencyLimits(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.sardine.sardineGetCurrencyLimits(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.sardine.request = fakeRequest2;
        try {
          const data = await server.externalServices.sardine.sardineGetCurrencyLimits(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if sardine is commented in config', async () => {
        config.sardine = undefined;

        try {
          const data = await server.externalServices.sardine.sardineGetCurrencyLimits(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        }
        server.externalServices.sardine.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.sardine.sardineGetToken(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.sardine.sardineGetToken(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if post returns error', async () => {
        const fakeRequest2 = {
          post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.sardine.request = fakeRequest2;
        try {
          const data = await server.externalServices.sardine.sardineGetToken(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.referenceId;
        try {
          const data = await server.externalServices.sardine.sardineGetToken(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Sardine\'s request missing arguments');
        }
      });

      it('should return error if sardine is commented in config', async () => {
        config.sardine = undefined;

        try {
          const data = await server.externalServices.sardine.sardineGetToken(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        }
        server.externalServices.sardine.request = fakeRequest;
      });

      it('should work properly if req is OK', async() => {
        try {
          const data = await server.externalServices.sardine.sardineGetSupportedTokens(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async() => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.sardine.sardineGetSupportedTokens(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async() => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.sardine.request = fakeRequest2;
        try {
          const data = await server.externalServices.sardine.sardineGetSupportedTokens(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if sardine is commented in config', async() => {
        config.sardine = undefined;

        try {
          const data = await server.externalServices.sardine.sardineGetSupportedTokens(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
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
        }
        server.externalServices.sardine.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.sardine.request = fakeRequest2;
        try {
          const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.orderId;
        try {
          const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Sardine\'s request missing arguments');
        }
      });

      it('should work properly if orderId is not present but externalUserId is', async () => {
        delete req.body.orderId;
        req.body.externalUserId = 'externalUserId1';
        try {
          const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if sardine is commented in config', async () => {
        config.sardine = undefined;

        try {
          const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Sardine missing credentials');
        }
      });
    });
  });