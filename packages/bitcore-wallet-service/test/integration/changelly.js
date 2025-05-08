'use strict';

const chai = require('chai');
const crypto = require('crypto');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js').default;
let server, wallet, fakeRequest, req;

let { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'pkcs1',
    format: 'der'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'der'
  }
  });

describe('Changelly integration', () => {
  before((done) => {
    helpers.before((res) => {
      done();
    });
  });
  beforeEach((done) => {
    config.suspendedChains = [];
    config.changelly = {
      v1: {
        apiKey: 'apiKeyV1',
        secret: 'secretV1',
        api: 'apiV1'
      },
      v2: {
        secret: privateKey.toString('hex'),
        api: 'apiV2'
      }
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
          useV2: true
        }
      }
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', () => {
      server.externalServices.changelly.changellyGetCurrencies(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.id;
      server.externalServices.changelly.changellyGetCurrencies(req).then(data => {
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

      server.externalServices.changelly.request = fakeRequest2;
      server.externalServices.changelly.changellyGetCurrencies(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.externalServices.changelly.changellyGetCurrencies(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });

    it('should return error if req is v1', () => {
      delete req.body.useV2;
      server.externalServices.changelly.changellyGetCurrencies(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
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
          coinTo: 'eth',
          useV2: true
        }
      }
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', () => {
      server.externalServices.changelly.changellyGetPairsParams(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.coinFrom;

      server.externalServices.changelly.changellyGetPairsParams(req).then(data => {
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

      server.externalServices.changelly.request = fakeRequest2;
      server.externalServices.changelly.changellyGetPairsParams(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.externalServices.changelly.changellyGetPairsParams(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });

    it('should return error if req is v1', () => {
      delete req.body.useV2;
      server.externalServices.changelly.changellyGetPairsParams(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
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
          amountFrom: '1.123',
          useV2: true
        }
      }
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', () => {
      server.externalServices.changelly.changellyGetFixRateForAmount(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.coinFrom;

      server.externalServices.changelly.changellyGetFixRateForAmount(req).then(data => {
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

      server.externalServices.changelly.request = fakeRequest2;
      server.externalServices.changelly.changellyGetFixRateForAmount(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.externalServices.changelly.changellyGetFixRateForAmount(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });

    it('should return error if req is v1', () => {
      delete req.body.useV2;
      server.externalServices.changelly.changellyGetFixRateForAmount(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
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
          refundAddress: 'refundAddress',
          useV2: true
        }
      }
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', () => {
      server.externalServices.changelly.changellyCreateFixTransaction(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.coinFrom;

      server.externalServices.changelly.changellyCreateFixTransaction(req).then(data => {
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

      server.externalServices.changelly.request = fakeRequest2;
      server.externalServices.changelly.changellyCreateFixTransaction(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.externalServices.changelly.changellyCreateFixTransaction(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });

    it('should return error if req is v1', () => {
      delete req.body.useV2;
      server.externalServices.changelly.changellyCreateFixTransaction(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      });
    });
  });

  describe('#changellyGetTransactions', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: "test",
          exchangeTxId: 'exchangeTxId',
          useV2: true
        }
      }
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', async() => {
      try {
        const data = await server.externalServices.changelly.changellyGetTransactions(req);
        should.exist(data);
      } catch (err) {
        should.not.exist(err);
      }
    });

    it('should return error if there is some missing arguments', async() => {
      delete req.body.exchangeTxId;

      try {
        const data = await server.externalServices.changelly.changellyGetTransactions(req);
        should.not.exist(data);
      } catch (err) {
        should.exist(err);
        err.message.should.equal('changellyGetTransactions request missing arguments');
      }
    });

    it('should return error if post returns error', async() => {
      req.body.exchangeTxId = 'exchangeTxId';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };
      server.externalServices.changelly.request = fakeRequest2;

      try {
        const data = await server.externalServices.changelly.changellyGetTransactions(req);
        should.not.exist(data);
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Error');
      }
    });

    it('should return error if Changelly is commented in config', async() => {
      config.changelly = undefined;

      try {
        const data = await server.externalServices.changelly.changellyGetTransactions(req);
        should.not.exist(data);
      } catch (err) {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      }
    });

    it('should return error if req is v1', () => {
      delete req.body.useV2;
      server.externalServices.changelly.changellyGetTransactions(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      });
    });
  });

  describe('#changellyGetStatus', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: "test",
          exchangeTxId: 'exchangeTxId',
          useV2: true
        }
      }
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', () => {
      server.externalServices.changelly.changellyGetStatus(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.exchangeTxId;

      server.externalServices.changelly.changellyGetStatus(req).then(data => {
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

      server.externalServices.changelly.request = fakeRequest2;
      server.externalServices.changelly.changellyGetStatus(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Changelly is commented in config', () => {
      config.changelly = undefined;

      server.externalServices.changelly.changellyGetStatus(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('ClientError: Service not configured.');
      });
    });

    it('should return error if req is v1', () => {
      delete req.body.useV2;
      server.externalServices.changelly.changellyGetStatus(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      });
    });
  });
});