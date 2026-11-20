'use strict';

import * as chai from 'chai';
import * as sinon from 'sinon';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';
import logger from '../../../src/lib/logger';

const should = chai.should();

describe('Thorswap integration', () => {
  const sandbox = sinon.createSandbox();
  let server;
  let wallet;
  let fakeRequest;
  let req;
  let loggerError: sinon.SinonStub;

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
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
    };

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
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
    sandbox.stub(logger, 'warn');
    loggerError = sandbox.stub(logger, 'error');
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(async () => {
    await helpers.after();
  });

  describe('#thorswapGetSupportedChains', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          includeDetails: true,
        }
      };
      server.externalServices.thorswap.request = fakeRequest;
    });

    it('should work properly if req is OK with includeDetails true', async () => {
      const data = await server.externalServices.thorswap.thorswapGetSupportedChains(req);
      should.exist(data);
    });

    it('should work properly if req is OK with includeDetails false', async () => {
      req.body.includeDetails = false;
      const data = await server.externalServices.thorswap.thorswapGetSupportedChains(req);
      should.exist(data);
    });

    it('should work properly if req is OK without includeDetails param', async () => {
      delete req.body.includeDetails;
      const data = await server.externalServices.thorswap.thorswapGetSupportedChains(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.thorswap.request = fakeRequest2;
      try {
        await server.externalServices.thorswap.thorswapGetSupportedChains(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Thorswap request failed with error (');
        err.message.should.equal('Failed to get Thorswap supported chains');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.thorswap.request = fakeRequest2;
      try {
        await server.externalServices.thorswap.thorswapGetSupportedChains(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap did not return supported chains');
      }
    });

    it('should return error if Thorswap is commented in config', async () => {
      config.thorswap = undefined;
      try {
        await server.externalServices.thorswap.thorswapGetSupportedChains(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap missing credentials');
      }
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
      };
      server.externalServices.thorswap.request = fakeRequest;
    });

    it('should work properly if req is OK with includeDetails true', async () => {
      const data = await server.externalServices.thorswap.thorswapGetCryptoCurrencies(req);
      should.exist(data);
    });

    it('should work properly if req is OK with includeDetails false', async () => {
      req.body.includeDetails = false;
      const data = await server.externalServices.thorswap.thorswapGetCryptoCurrencies(req);
      should.exist(data);
    });

    it('should work properly if req is OK without includeDetails param', async () => {
      delete req.body.includeDetails;
      const data = await server.externalServices.thorswap.thorswapGetCryptoCurrencies(req);
      should.exist(data);
    });

    it('should work properly if req is OK without categories param', async () => {
      delete req.body.categories;
      const data = await server.externalServices.thorswap.thorswapGetCryptoCurrencies(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.thorswap.request = fakeRequest2;
      try {
        await server.externalServices.thorswap.thorswapGetCryptoCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Thorswap request failed with error (');
        err.message.should.equal('Failed to get Thorswap supported currencies');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.thorswap.request = fakeRequest2;
      try {
        await server.externalServices.thorswap.thorswapGetCryptoCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap did not return supported currencies');
      }
    });

    it('should return error if Thorswap is commented in config', async () => {
      config.thorswap = undefined;

      try {
        await server.externalServices.thorswap.thorswapGetCryptoCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap missing credentials');
      }
    });
  });

  describe('#thorswapGetSwapQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          sellAsset: 'btc',
          buyAsset: 'eth',
          sellAmount: '1.123'
        }
      };
      server.externalServices.thorswap.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.thorswap.thorswapGetSwapQuote(req);
      should.exist(data);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.sellAmount;

      try {
        await server.externalServices.thorswap.thorswapGetSwapQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap\'s request missing arguments');
      }
    });

    it('should return error if get returns error', async () => {
      req.body.sellAmount = '1.123';
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.thorswap.request = fakeRequest2;
      try {
        await server.externalServices.thorswap.thorswapGetSwapQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Thorswap request failed with error (');
        err.message.should.equal('Failed to get Thorswap swap quote');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      req.body.sellAmount = '1.123';
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.thorswap.request = fakeRequest2;
      try {
        await server.externalServices.thorswap.thorswapGetSwapQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap did not return a swap quote');
      }
    });

    it('should return error if Thorswap is commented in config', async () => {
      config.thorswap = undefined;
      try {
        await server.externalServices.thorswap.thorswapGetSwapQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap missing credentials');
      }
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
      };
      server.externalServices.thorswap.request = fakeRequest;
    });

    it('should work properly if req is OK with txn param only', async() => {
      const data = await server.externalServices.thorswap.thorswapGetSwapTx(req);
      should.exist(data);
    });

    it('should work properly if req is OK with hash param only', async() => {
      delete req.body.txn;
      req.body.hash = 'hash1';
      const data = await server.externalServices.thorswap.thorswapGetSwapTx(req);
      should.exist(data);
    });

    it('should return error if it does not have any of the required parameters', async() => {
      delete req.body.txn;
      delete req.body.hash;

      try {
        await server.externalServices.thorswap.thorswapGetSwapTx(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap\'s request missing arguments');
      }
    });

    it('should return error if post returns error', async() => {
      req.body.txn = 'txn1';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.thorswap.request = fakeRequest2;
      try {
        await server.externalServices.thorswap.thorswapGetSwapTx(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Thorswap request failed with error (');
        err.message.should.equal('Failed to get Thorswap swap transaction');
      }
    });

    it('should return error and not leak the response if body is empty', async() => {
      req.body.txn = 'txn1';
      const fakeRequest2 = {
        post: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.thorswap.request = fakeRequest2;
      try {
        await server.externalServices.thorswap.thorswapGetSwapTx(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap did not return a swap transaction');
      }
    });

    it('should return error if Thorswap is commented in config', async() => {
      config.thorswap = undefined;
      try {
        await server.externalServices.thorswap.thorswapGetSwapTx(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Thorswap missing credentials');
      }
    });
  });
});