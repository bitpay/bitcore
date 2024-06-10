'use strict';

const chai = require('chai');
const should = chai.should();
const { WalletService } = require('../../ts_build/lib/server');
const TestData = require('../testdata');
const helpers = require('./helpers');

let config = require('../../ts_build/config.js').default;
let server, wallet, fakeRequest, req;

describe('Thorswap integration', () => {
  before((done) => {
    helpers.before((res) => {
      done();
    });
  });
  beforeEach((done) => {
    config.suspendedChains = [];
    config.thorswap = {
      sandbox: {
        api: 'thorswapApi1',
        apiKey: 'thorswapApiKey1',
        secretKey: 'thorswapSecretKey1',
        referer: 'thorswapReferer1'
      },
      production: {
        api: 'thorswapApi2',
        apiKey: 'thorswapApiKey2',
        secretKey: 'thorswapSecretKey2',
        referer: 'thorswapReferer2'
      },
      sandboxWeb: {
        api: 'thorswapApi3',
        apiKey: 'thorswapApiKey3',
        secretKey: 'thorswapSecretKey3',
        referer: 'thorswapReferer3'
      },
      productionWeb: {
        api: 'thorswapApi4',
        apiKey: 'thorswapApiKey4',
        secretKey: 'thorswapSecretKey4',
        referer: 'thorswapReferer4'
      },
    }

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { data: 'data' }) },
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

  describe('#thorswapGetSupportedChains', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          includeDetails: true,
        }
      }
    });

    it('should work properly if req is OK with includeDetails true', () => {
      server.request = fakeRequest;
      server.thorswapGetSupportedChains(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should work properly if req is OK with includeDetails false', () => {
      req.body.includeDetails = false;
      server.request = fakeRequest;
      server.thorswapGetSupportedChains(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should work properly if req is OK without includeDetails param', () => {
      delete req.body.includeDetails;
      server.request = fakeRequest;
      server.thorswapGetSupportedChains(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if get returns error', () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.request = fakeRequest2;
      server.thorswapGetSupportedChains(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Thorswap is commented in config', () => {
      config.thorswap = undefined;

      server.request = fakeRequest;
      server.thorswapGetSupportedChains(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Thorswap missing credentials');
      });
    });
  });

  describe('#thorswapGetCryptoCurrencies', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          includeDetails: true,
          categories: 'all',
        }
      }
    });

    it('should work properly if req is OK with includeDetails true', () => {
      server.request = fakeRequest;
      server.thorswapGetCryptoCurrencies(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should work properly if req is OK with includeDetails false', () => {
      req.body.includeDetails = false;
      server.request = fakeRequest;
      server.thorswapGetCryptoCurrencies(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should work properly if req is OK without includeDetails param', () => {
      delete req.body.includeDetails;
      server.request = fakeRequest;
      server.thorswapGetCryptoCurrencies(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should work properly if req is OK without categories param', () => {
      delete req.body.categories;
      server.request = fakeRequest;
      server.thorswapGetCryptoCurrencies(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if get returns error', () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.request = fakeRequest2;
      server.thorswapGetCryptoCurrencies(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Thorswap is commented in config', () => {
      config.thorswap = undefined;

      server.request = fakeRequest;
      server.thorswapGetCryptoCurrencies(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Thorswap missing credentials');
      });
    });
  });

  describe('#thorswapGetSwapQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          sellAsset: "btc",
          buyAsset: 'eth',
          sellAmount: '1.123'
        }
      }
    });

    it('should work properly if req is OK', () => {
      server.request = fakeRequest;
      server.thorswapGetSwapQuote(req).then(data => {
        should.exist(data);
      }).catch(err => {
        should.not.exist(err);
      });
    });

    it('should return error if there is some missing arguments', () => {
      delete req.body.sellAmount;

      server.request = fakeRequest;
      server.thorswapGetSwapQuote(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Thorswap\'s request missing arguments');
      });
    });

    it('should return error if get returns error', () => {
      req.body.sellAmount = '1.123';
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.request = fakeRequest2;
      server.thorswapGetSwapQuote(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Error');
      });
    });

    it('should return error if Thorswap is commented in config', () => {
      config.thorswap = undefined;

      server.request = fakeRequest;
      server.thorswapGetSwapQuote(req).then(data => {
        should.not.exist(data);
      }).catch(err => {
        should.exist(err);
        err.message.should.equal('Thorswap missing credentials');
      });
    });
  });

  describe('#thorswapGetSwapTx', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          txn: 'txn1'
        }
      }
    });

    it('should work properly if req is OK with txn param only', async() => {
      server.request = fakeRequest;
      try {
        const data = await server.thorswapGetSwapTx(req);
        should.exist(data);
      } catch (err) {
        should.not.exist(err);
      }
    });

    it('should work properly if req is OK with hash param only', async() => {
      delete req.body.txn;
      req.body.hash = 'hash1';
      server.request = fakeRequest;
      try {
        const data = await server.thorswapGetSwapTx(req);
        should.exist(data);
      } catch (err) {
        should.not.exist(err);
      }
    });

    it('should return error if it does not have any of the required parameters', async() => {
      delete req.body.txn;
      delete req.body.hash;
      server.request = fakeRequest;

      try {
        const data = await server.thorswapGetSwapTx(req);
        should.not.exist(data);
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Thorswap\'s request missing arguments');
      }
    });

    it('should return error if post returns error', async() => {
      req.body.txn = 'txn1';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };
      server.request = fakeRequest2;

      try {
        const data = await server.thorswapGetSwapTx(req);
        should.not.exist(data);
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Error');
      }
    });

    it('should return error if Thorswap is commented in config', async() => {
      config.thorswap = undefined;
      server.request = fakeRequest;

      try {
        const data = await server.thorswapGetSwapTx(req);
        should.not.exist(data);
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Thorswap missing credentials');
      }
    });
  });
});