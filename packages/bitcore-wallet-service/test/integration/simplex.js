'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js').default;
let server, wallet, fakeRequest, req;

  describe('Simplex integration', () => {
    before((done) => {
      helpers.before((res) => {
        done();
      });
    });
    beforeEach((done) => {
      config.simplex = {
        sandbox: {
          apiKey: 'apiKey1',
          api: 'api1',
          apiSell: 'apiSell1',
          appProviderId: 'appProviderId1',
          appSellRefId: 'appSellRefId1',
          publicKey: 'publicKey1'
        },
        production: {
          apiKey: 'apiKey2',
          api: 'api2',
          apiSell: 'apiSell2',
          appProviderId: 'appProviderId2',
          appSellRefId: 'appSellRefId2',
          publicKey: 'publicKey2'
        },
        sandboxWeb: {
          apiKey: 'apiKey3',
          api: 'api3',
          apiSell: 'apiSell3',
          appProviderId: 'appProviderId3',
          appSellRefId: 'appSellRefId3',
          publicKey: 'publicKey3'
        },
        productionWeb: {
          apiKey: 'apiKey4',
          api: 'api4',
          apiSell: 'apiSell4',
          appProviderId: 'appProviderId4',
          appSellRefId: 'appSellRefId4',
          publicKey: 'publicKey4'
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

    describe('#simplexGetCurrencies', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox'
          },
        }
        server.externalServices.simplex.request = fakeRequest;
      });

      it('should work properly if req is OK', () => {
        server.externalServices.simplex.simplexGetCurrencies(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });

      it('should work properly if req is OK for web', () => {
        req.body.context = 'web';
        server.externalServices.simplex.simplexGetCurrencies(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });

      it('should return error if get returns error', () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.simplex.request = fakeRequest2;
        server.externalServices.simplex.simplexGetCurrencies(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Error');
        });
      });

      it('should return error if simplex is commented in config', () => {
        config.simplex = undefined;

        server.externalServices.simplex.simplexGetCurrencies(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Simplex missing credentials');
        });
      });
    });

    describe('#simplexGetQuote', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox'
          },
          ip: '1.2.3.4'
        }
        server.externalServices.simplex.request = fakeRequest;
      });

      it('should work properly if req is OK', () => {
        server.externalServices.simplex.simplexGetQuote(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });

      it('should work properly if req is OK for web', () => {
        req.body.context = 'web';
        server.externalServices.simplex.simplexGetQuote(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });

      it('should return error if post returns error', () => {
        const fakeRequest2 = {
          post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.simplex.request = fakeRequest2;
        server.externalServices.simplex.simplexGetQuote(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Error');
        });
      });

      it('should return error if simplex is commented in config', () => {
        config.simplex = undefined;

        server.externalServices.simplex.simplexGetQuote(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Simplex missing credentials');
        });
      });
    });

    describe('#simplexGetSellQuote', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox',
            userCountry: 'LT',
            base_currency: 'BTC',
            base_amount: 1000000,
            quote_currency: 'EUR',
            pp_payment_method: 'sepa'
          }
        }
        server.externalServices.simplex.request = fakeRequest;
      });

      it('should work properly if req is OK', async () => {
        try {
          const data = await server.externalServices.simplex.simplexGetSellQuote(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should work properly if req is OK for web', async () => {
        req.body.context = 'web';
        try {
          const data = await server.externalServices.simplex.simplexGetSellQuote(req);
          should.exist(data);
        } catch (err) {
          should.not.exist(err);
        }
      });

      it('should return error if get returns error', async () => {
        const fakeRequest2 = {
          get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.simplex.request = fakeRequest2;
        try {
          const data = await server.externalServices.simplex.simplexGetSellQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Error');
        };
      });

      it('should return error if there is some missing arguments', async () => {
        delete req.body.base_amount;
        try {
          const data = await server.externalServices.simplex.simplexGetSellQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Simplex\'s request missing arguments');
        }
      });

      it('should return error if simplex is commented in config', async () => {
        config.simplex = undefined;

        try {
          const data = await server.externalServices.simplex.simplexGetSellQuote(req);
          should.not.exist(data);
        } catch (err) {
          should.exist(err);
          err.message.should.equal('Simplex missing credentials');
        }
      });
    });

    describe('#simplexPaymentRequest', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'production',
            account_details: {
            },
            transaction_details: {
              payment_details: {
              }
            }
          },
          ip: '1.2.3.4'
        }

        fakeRequest = {
          post: (_url, _opts, _cb) => { return _cb(null, { body: {} }) },
        };
        server.externalServices.simplex.request = fakeRequest;
      });

      it('should work properly if req is OK', () => {
        server.externalServices.simplex.simplexPaymentRequest(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });

      it('should return error if post returns error', () => {
        const fakeRequest2 = {
          post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.simplex.request = fakeRequest2;
        server.externalServices.simplex.simplexPaymentRequest(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Error');
        });
      });

      it('should return error if there is some missing arguments', () => {
        delete req.body.transaction_details;

        server.externalServices.simplex.simplexPaymentRequest(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Simplex\'s request missing arguments');
        });
      });

      it('should return error if simplex is commented in config', () => {
        config.simplex = undefined;

        server.externalServices.simplex.simplexPaymentRequest(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Simplex missing credentials');
        });
      });
    });

    describe('#simplexSellPaymentRequest', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'production',     
            userCountry: 'LT',
            referer_url: 'https://referer_url.com/',
            return_url: 'https://return_url.com/',
            txn_details: {quote_id: 'quote_id_1'},
          },
          ip: '1.2.3.4'
        }

        fakeRequest = {
          post: (_url, _opts, _cb) => { return _cb(null, { body: {} }) },
        };
        server.externalServices.simplex.request = fakeRequest;
      });

      it('should work properly if req is OK', () => {
        server.externalServices.simplex.simplexSellPaymentRequest(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });

      it('should return error if post returns error', () => {
        const fakeRequest2 = {
          post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
        };

        server.externalServices.simplex.request = fakeRequest2;
        server.externalServices.simplex.simplexSellPaymentRequest(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Error');
        });
      });

      it('should return error if there is some missing arguments', () => {
        delete req.body.return_url;

        server.externalServices.simplex.simplexSellPaymentRequest(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Simplex\'s request missing arguments');
        });
      });

      it('should return error if simplex is commented in config', () => {
        config.simplex = undefined;

        server.externalServices.simplex.simplexSellPaymentRequest(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Simplex missing credentials');
        });
      });
    });

    describe('#simplexGetEvents', () => {
      beforeEach(() => {
        req = {
          env: 'production'
        }

        fakeRequest = {
          get: (_url, _opts, _cb) => { return _cb(null, { body: {} }) },
        };
        server.externalServices.simplex.request = fakeRequest;
      });

      it('should work properly if req is OK', () => {
        server.externalServices.simplex.simplexGetEvents(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });
    });
  });