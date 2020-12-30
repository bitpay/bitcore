'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js');
let server, wallet, fakeRequest, req;

describe('Changelly integration', () => {
  before((done) => {
    helpers.before((res) => {
      done();
    });
  });
  beforeEach((done) => {
    config.suspendedChains = [];
    config.changelly = {
      apiKey: 'xxxx',
      secret: 'xxxx',
      api: 'xxxx'
    }

    fakeRequest = {
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data'}) },
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

  describe('#changellyGetCurrencies', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: "test",
        }
      }
    });

    it('should work properly if req is OK', () => {
      server.request = fakeRequest;
      server.changellyGetCurrencies(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.id;

      server.request = fakeRequest;
      server.changellyGetCurrencies(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('changellyGetCurrencies request missing arguments');
      });
    });

    it('should return error if post returns error', () => {
      req.body.id = 'test';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.request = fakeRequest2;
      server.changellyGetCurrencies(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.request = fakeRequest;
      server.changellyGetCurrencies(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });
  });

  describe('#changellyGetPairsParams', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: "test",
          coinFrom: 'btc',
          coinTo: 'eth'
        }
      }
    });

    it('should work properly if req is OK', () => {
      server.request = fakeRequest;
      server.changellyGetPairsParams(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.coinFrom;

      server.request = fakeRequest;
      server.changellyGetPairsParams(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('changellyGetPairsParams request missing arguments');
      });
    });

    it('should return error if post returns error', () => {
      req.body.coinFrom = 'btc';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.request = fakeRequest2;
      server.changellyGetPairsParams(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.request = fakeRequest;
      server.changellyGetPairsParams(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });
  });

  describe('#changellyGetFixRateForAmount', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: "test",
          coinFrom: 'btc',
          coinTo: 'eth',
          amountFrom: '1.123'
        }
      }
    });

    it('should work properly if req is OK', () => {
      server.request = fakeRequest;
      server.changellyGetFixRateForAmount(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.coinFrom;

      server.request = fakeRequest;
      server.changellyGetFixRateForAmount(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('changellyGetFixRateForAmount request missing arguments');
      });
    });

    it('should return error if post returns error', () => {
      req.body.coinFrom = 'btc';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.request = fakeRequest2;
      server.changellyGetFixRateForAmount(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.request = fakeRequest;
      server.changellyGetFixRateForAmount(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });
  });

  describe('#changellyCreateFixTransaction', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: "test",
          coinFrom: 'btc',
          coinTo: 'eth',
          amountFrom: '1.123',
          addressTo: '10.321',
          fixedRateId: '3.123',
          refundAddress: 'refundAddress'
        }
      }
    });

    it('should work properly if req is OK', () => {
      server.request = fakeRequest;
      server.changellyCreateFixTransaction(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.coinFrom;

      server.request = fakeRequest;
      server.changellyCreateFixTransaction(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('changellyCreateFixTransaction request missing arguments');
      });
    });

    it('should return error if post returns error', () => {
      req.body.coinFrom = 'btc';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.request = fakeRequest2;
      server.changellyCreateFixTransaction(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.request = fakeRequest;
      server.changellyCreateFixTransaction(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });
  });

  describe('#changellyGetStatus', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: "test",
          exchangeTxId: 'exchangeTxId'
        }
      }
    });

    it('should work properly if req is OK', () => {
      server.request = fakeRequest;
      server.changellyGetStatus(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.exchangeTxId;

      server.request = fakeRequest;
      server.changellyGetStatus(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('changellyGetStatus request missing arguments');
      });
    });

    it('should return error if post returns error', () => {
      req.body.exchangeTxId = 'exchangeTxId';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.request = fakeRequest2;
      server.changellyGetStatus(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.request = fakeRequest;
      server.changellyGetStatus(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });
  });
});