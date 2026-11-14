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

describe('OneInch integration', function() {
  this.timeout(5000);
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
    config.oneInch = {
      api: 'xxxx',
      referrerAddress: 'referrerAddress',
      referrerFee: 'referrerFee1'
    };

    fakeRequest = {
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
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

  describe('#oneInchGetReferrerFee', () => {
    beforeEach(() => {
      req = {};
      server.externalServices.oneInch.request = fakeRequest;
    });

    it('should get referrel fee if it is defined in config', async () => {
      const data = await server.externalServices.oneInch.oneInchGetReferrerFee(req);
      should.exist(data);
      data.referrerFee.should.equal('referrerFee1');
    });

    it('should return error if oneInch is commented in config', async () => {
      config.oneInch = undefined;
      try {
        await server.externalServices.oneInch.oneInchGetReferrerFee(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('1Inch missing credentials');
      }
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
      };
      server.externalServices.oneInch.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.oneInch.oneInchGetSwap(req);
      should.exist(data);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.fromTokenAddress;
      try {
        await server.externalServices.oneInch.oneInchGetSwap(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('oneInchGetSwap request missing arguments');
      }
    });

    it('should return error if request returns error', async () => {
      req.body.fromTokenAddress = 'fromTokenAddress1';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); }
      };

      server.externalServices.oneInch.request = fakeRequest2;
      try {
        await server.externalServices.oneInch.oneInchGetSwap(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('1Inch request failed with error (');
        err.message.should.equal('Failed to get 1Inch swap data');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        post: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); }
      };

      server.externalServices.oneInch.request = fakeRequest2;
      try {
        await server.externalServices.oneInch.oneInchGetSwap(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('1Inch did not return swap data');
      }
    });

    it('should return error if oneInch is commented in config', async () => {
      config.oneInch = undefined;

      try {
        await server.externalServices.oneInch.oneInchGetSwap(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('1Inch missing credentials');
      }
    });
  });

  describe('#oneInchGetTokens', () => {
    beforeEach(() => {
      req = {};
      fakeRequest = {
        get: (_url, _opts, _cb) => { return _cb(null, { body: { tokens: 'data' } }); },
      };
      server.externalServices.oneInch.request = fakeRequest;
    });

    it('should get oneInch list of supported tokens', async () => {
      const data = await server.externalServices.oneInch.oneInchGetTokens(req);
      should.exist(data);
    });

    it('should return error if oneInch is commented in config', async () => {
      config.oneInch = undefined;
      try {
        await server.externalServices.oneInch.oneInchGetTokens(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('1Inch missing credentials');
      }
    });
  });
});