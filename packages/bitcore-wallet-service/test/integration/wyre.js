'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js').default;
let server, wallet, fakeRequest, req;

  describe('Wyre integration', () => {
    before((done) => {
      helpers.before((res) => {
        done();
      });
    });
    beforeEach((done) => {
      config.wyre = {
        sandbox: {
          apiKey: 'xxxx',
          secretApiKey: 'xxxx',
          api: 'xxxx',
          widgetUrl: 'xxxx',
          appProviderAccountId: 'xxxx'
        },
        production: {
          apiKey: 'xxxx',
          secretApiKey: 'xxxx',
          api: 'xxxx',
          widgetUrl: 'xxxx',
          appProviderAccountId: 'xxxx'
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

    describe('#wyreWalletOrderQuotation', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox',
            amount: 50,
            sourceCurrency: 'USD',
            destCurrency: 'BTC',
            dest: 'bitcoin:123123123',
            country: 'US'
          }
        }
        server.externalServices.wyre.request = fakeRequest;
      });

      it('should work properly if req is OK', () => {
        server.externalServices.wyre.wyreWalletOrderQuotation(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });

      it('should return error if there is some missing arguments', () => {
        delete req.body.amount;

        server.externalServices.wyre.wyreWalletOrderQuotation(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Wyre\'s request missing arguments');
        });
      });

      it('should return error if post returns error', () => {
        req.body.amount = 50;
        const fakeRequest2 = {
          post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
        };

        server.externalServices.wyre.request = fakeRequest2;
        server.externalServices.wyre.wyreWalletOrderQuotation(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Error');
        });
      });

      it('should return error if Wyre is commented in config', () => {
        config.wyre = undefined;

        server.externalServices.wyre.wyreWalletOrderQuotation(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Wyre missing credentials');
        });
      });

      it('should return error if amountIncludeFees is true but sourceAmount is not present', () => {
        req = {
          headers: {},
          body: {
            amountIncludeFees: true,
            env: 'sandbox',
            amount: 50,
            sourceCurrency: 'USD',
            destCurrency: 'BTC',
            dest: 'bitcoin:123123123',
            country: 'US',
            walletType: 'DEBIT_CARD'
          }
        }

        server.externalServices.wyre.wyreWalletOrderQuotation(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Wyre\'s request missing arguments');
        });
      });

      it('should work properly if req is OK with amountIncludeFees and sourceAmount', () => {
        req = {
          headers: {},
          body: {
            amountIncludeFees: true,
            env: 'sandbox',
            sourceAmount: 50,
            sourceCurrency: 'USD',
            destCurrency: 'BTC',
            dest: 'bitcoin:123123123',
            country: 'US',
            walletType: 'DEBIT_CARD'
          }
        }

        server.externalServices.wyre.wyreWalletOrderQuotation(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });
    });

    describe('#wyreWalletOrderReservation', () => {
      beforeEach(() => {
        req = {
          headers: {},
          body: {
            env: 'sandbox',
            amount: 50,
            sourceCurrency: 'USD',
            destCurrency: 'BTC',
            dest: 'bitcoin:123123123',
            paymentMethod: 'debit-card'
          }
        }

        fakeRequest = {
          post: (_url, _opts, _cb) => { return _cb(null, { body: {} }) },
        };
        server.externalServices.wyre.request = fakeRequest;
      });

      it('should work properly if req is OK', () => {
        server.externalServices.wyre.wyreWalletOrderReservation(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });

      it('should return error if there is some missing arguments', () => {
        delete req.body.amount;

        server.externalServices.wyre.wyreWalletOrderReservation(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Wyre\'s request missing arguments');
        });
      });

      it('should return error if post returns error', () => {
        req.body.amount = 50;
        const fakeRequest2 = {
          post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
        };

        server.externalServices.wyre.request = fakeRequest2;
        server.externalServices.wyre.wyreWalletOrderReservation(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Error');
        });
      });

      it('should return error if Wyre is commented in config', () => {
        config.wyre = undefined;

        server.externalServices.wyre.wyreWalletOrderReservation(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Wyre missing credentials');
        });
      });

      it('should return error if amountIncludeFees is true but sourceAmount is not present', () => {
        req = {
          headers: {},
          body: {
            amountIncludeFees: true,
            env: 'sandbox',
            amount: 50,
            sourceCurrency: 'USD',
            destCurrency: 'BTC',
            dest: 'bitcoin:123123123',
            country: 'US',
            paymentMethod: 'debit-card'
          }
        }

        server.externalServices.wyre.wyreWalletOrderReservation(req).then(data => {
          should.not.exist(data);
        }).catch(err => {
          should.exist(err);
          err.message.should.equal('Wyre\'s request missing arguments');
        });
      });

      it('should work properly if req is OK with amountIncludeFees and sourceAmount', () => {
        req = {
          headers: {},
          body: {
            amountIncludeFees: true,
            env: 'sandbox',
            sourceAmount: 50,
            sourceCurrency: 'USD',
            destCurrency: 'BTC',
            dest: 'bitcoin:123123123',
            country: 'US',
            paymentMethod: 'debit-card'
          }
        }

        server.externalServices.wyre.wyreWalletOrderReservation(req).then(data => {
          should.exist(data);
        }).catch(err => {
          should.not.exist(err);
        });
      });
    });
  });