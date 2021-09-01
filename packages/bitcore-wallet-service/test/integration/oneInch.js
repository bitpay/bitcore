'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js');
let server, wallet, fakeRequest, req;

describe('OneInch integration', () => {
  before((done) => {
    helpers.before((res) => {
      done();
    });
  });
  beforeEach((done) => {
    config.suspendedChains = [];
    config.oneInch = {
      api: 'xxxx',
      referrerAddress: 'referrerAddress',
      referrerFee: 'referrerFee1'
    }

    fakeRequest = {
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data'}) },
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data'}) },
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

  describe('#oneInchGetReferrerFee', () => {
    beforeEach(() => {
      req = {}
    });

    it('should get referrel fee if it is defined in config', () => {
      server.request = fakeRequest;
      server.oneInchGetReferrerFee(req).then(data => {
        should.exist(data);
        data.referrerFee.should.equal('referrerFee1');
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if oneInch is commented in config', () => {
      config.oneInch = undefined;

      server.request = fakeRequest;
      server.oneInchGetReferrerFee(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('1Inch missing credentials');
      });
    });
  });

  describe('#oneInchGetSwap', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          fromTokenAddress: 'fromTokenAddress1',
          toTokenAddress: 'toTokenAddress1',
          amount: 100,
          fromAddress: 'fromAddress1',
          slippage: 0.5,
          destReceiver: 'destReceiver1'
        }
      }
    });

    it('should work properly if req is OK', () => {
      server.request = fakeRequest;
      server.oneInchGetSwap(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.fromTokenAddress;

      server.request = fakeRequest;
      server.oneInchGetSwap(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('oneInchGetSwap request missing arguments');
      });
    });

    it('should return error if request returns error', () => {
      req.body.fromTokenAddress = 'fromTokenAddress1';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')) }
      };

      server.request = fakeRequest2;
      server.oneInchGetSwap(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if oneInch is commented in config', () => {
      config.oneInch = undefined;

      server.request = fakeRequest;
      server.oneInchGetSwap(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('1Inch missing credentials');
      });
    });
  });

  describe('#oneInchGetTokens', () => {
    beforeEach(() => {
      req = {};
      fakeRequest = {
        get: (_url, _opts, _cb) => { return _cb(null, { body: { tokens: 'data'}}) },
      };
    });

    it('should get oneInch list of supported tokens', () => {
      server.request = fakeRequest;
      server.oneInchGetTokens(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if oneInch is commented in config', () => {
      config.oneInch = undefined;

      server.request = fakeRequest;
      server.oneInchGetTokens(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('1Inch missing credentials');
      });
    });
  });
});