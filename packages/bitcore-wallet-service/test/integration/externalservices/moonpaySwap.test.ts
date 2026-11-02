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

describe('Moonpay Swap integration', () => {
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
    config.moonpaySwap = {
      sandbox: {
        api: 'moonpaySwapApi1',
        apiKey: 'moonpaySwapApiKey1'
      },
      production: {
        api: 'moonpaySwapApi2',
        apiKey: 'moonpaySwapApiKey2'
      },
      sandboxWeb: {
        api: 'moonpaySwapApi3',
        apiKey: 'moonpaySwapApiKey3'
      },
      productionWeb: {
        api: 'moonpaySwapApi4',
        apiKey: 'moonpaySwapApiKey4'
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

  describe('#moonpaySwapGetChainList', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      };
      server.externalServices.moonpaySwap.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.moonpaySwap.moonpaySwapGetChainList(req);
      should.exist(data);
    });

    it('should use the production keys if env is production', async () => {
      req.body.env = 'production';
      const spy = sandbox.spy(fakeRequest, 'get');
      await server.externalServices.moonpaySwap.moonpaySwapGetChainList(req);
      spy.args[0][0].should.equal('moonpaySwapApi2/getChainList');
      spy.args[0][1].headers['x-api-key'].should.equal('moonpaySwapApiKey2');
    });

    it('should use the web keys if context is web', async () => {
      req.body.env = 'production';
      req.body.context = 'web';
      const spy = sandbox.spy(fakeRequest, 'get');
      await server.externalServices.moonpaySwap.moonpaySwapGetChainList(req);
      spy.args[0][0].should.equal('moonpaySwapApi4/getChainList');
      spy.args[0][1].headers['x-api-key'].should.equal('moonpaySwapApiKey4');
    });

    it('should return error if the requested env has no config', async () => {
      delete config.moonpaySwap.productionWeb;
      req.body.env = 'production';
      req.body.context = 'web';
      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetChainList(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap missing credentials');
      }
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.moonpaySwap.request = fakeRequest2;
      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetChainList(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay Swap request failed with error (');
        err.message.should.equal('Failed to get Moonpay Swap supported chains');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpaySwap.request = fakeRequest2;
      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetChainList(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap did not return supported chains');
      }
    });

    it('should return error if Moonpay Swap is commented in config', async () => {
      config.moonpaySwap = undefined;
      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetChainList(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap missing credentials');
      }
    });
  });

  describe('#moonpaySwapGetTokenList', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          chainId: 1,
        }
      };
      server.externalServices.moonpaySwap.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const spy = sandbox.spy(fakeRequest, 'get');
      const data = await server.externalServices.moonpaySwap.moonpaySwapGetTokenList(req);
      should.exist(data);
      spy.args[0][0].should.equal('moonpaySwapApi1/getTokenList?chainId=1');
    });

    it('should request every chain if chainId is not present', async () => {
      delete req.body.chainId;
      const spy = sandbox.spy(fakeRequest, 'get');
      await server.externalServices.moonpaySwap.moonpaySwapGetTokenList(req);
      spy.args[0][0].should.equal('moonpaySwapApi1/getTokenList');
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpaySwap.request = fakeRequest2;
      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetTokenList(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap did not return supported tokens');
      }
    });
  });

  describe('#moonpaySwapGetPaths', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          srcChainId: 999000313,
          srcToken: '0x0000000000000000000000000000000000000000',
          dstChainId: 1,
          dstToken: '0x0000000000000000000000000000000000000000',
        }
      };
      server.externalServices.moonpaySwap.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const spy = sandbox.spy(fakeRequest, 'get');
      const data = await server.externalServices.moonpaySwap.moonpaySwapGetPaths(req);
      should.exist(data);
      spy.args[0][0].should.equal(
        'moonpaySwapApi1/getPaths?srcChainId=999000313&srcToken=0x0000000000000000000000000000000000000000&dstChainId=1&dstToken=0x0000000000000000000000000000000000000000'
      );
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.srcToken;

      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetPaths(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap\'s request missing arguments');
      }
    });
  });

  describe('#moonpaySwapGetQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          srcChainId: 8453,
          srcToken: '0x0000000000000000000000000000000000000000',
          dstChainId: 8453,
          dstToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          amount: '1000000000000000',
          swapDirection: 'exact-amount-in',
        }
      };
      server.externalServices.moonpaySwap.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const spy = sandbox.spy(fakeRequest, 'get');
      const data = await server.externalServices.moonpaySwap.moonpaySwapGetQuote(req);
      should.exist(data);
      spy.args[0][0].should.equal(
        'moonpaySwapApi1/getQuote?srcChainId=8453&srcToken=0x0000000000000000000000000000000000000000&dstChainId=8453&dstToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&amount=1000000000000000&swapDirection=exact-amount-in'
      );
    });

    it('should not forward params that are not part of the quote request', async () => {
      req.body.foo = 'bar';
      const spy = sandbox.spy(fakeRequest, 'get');
      await server.externalServices.moonpaySwap.moonpaySwapGetQuote(req);
      spy.args[0][0].should.not.contain('foo');
      spy.args[0][0].should.not.contain('env');
    });

    it('should not let the client set appFees', async () => {
      req.body.appFees = [{ bps: 50, receiverAddress: '0x123' }];
      const spy = sandbox.spy(fakeRequest, 'get');
      await server.externalServices.moonpaySwap.moonpaySwapGetQuote(req);
      spy.args[0][0].should.not.contain('appFees');
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.amount;

      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap\'s request missing arguments');
      }
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.moonpaySwap.request = fakeRequest2;
      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        loggerError.args[0][0].should.contain('Moonpay Swap request failed with error (');
        err.message.should.equal('Failed to get Moonpay Swap quote');
      }
    });

    it('should return error if Moonpay Swap is commented in config', async () => {
      config.moonpaySwap = undefined;
      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap missing credentials');
      }
    });
  });

  describe('#moonpaySwapGetAction', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          sender: '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045',
          srcChainId: 8453,
          srcToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
          dstChainId: 42161,
          dstToken: '0x0000000000000000000000000000000000000000',
          amount: '5000000',
          swapDirection: 'exact-amount-in',
          slippage: 100,
        }
      };
      server.externalServices.moonpaySwap.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const spy = sandbox.spy(fakeRequest, 'get');
      const data = await server.externalServices.moonpaySwap.moonpaySwapGetAction(req);
      should.exist(data);
      spy.args[0][0].should.contain('moonpaySwapApi1/getAction?actionType=swap-action&sender=0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045');
      spy.args[0][0].should.contain('&slippage=100');
    });

    it('should always request a swap action', async () => {
      req.body.actionType = 'evm-calldata-tx';
      const spy = sandbox.spy(fakeRequest, 'get');
      await server.externalServices.moonpaySwap.moonpaySwapGetAction(req);
      spy.args[0][0].should.contain('actionType=swap-action');
      spy.args[0][0].should.not.contain('evm-calldata-tx');
    });

    it('should forward recipient and returnDepositAddress', async () => {
      req.body.recipient = 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh';
      req.body.returnDepositAddress = true;
      const spy = sandbox.spy(fakeRequest, 'get');
      await server.externalServices.moonpaySwap.moonpaySwapGetAction(req);
      spy.args[0][0].should.contain('recipient=bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh');
      spy.args[0][0].should.contain('returnDepositAddress=true');
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.slippage;

      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetAction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap\'s request missing arguments');
      }
    });

    it('should return error and not leak the response if body is empty', async () => {
      const fakeRequest2 = {
        get: (_url, opts, cb) => { return cb(null, { statusCode: 200, body: undefined, request: { headers: opts.headers } }); },
      };

      server.externalServices.moonpaySwap.request = fakeRequest2;
      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetAction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap did not return a transaction');
      }
    });
  });

  describe('#moonpaySwapGetStatus', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          txHash: '0xabc',
          chainId: 8453,
        }
      };
      server.externalServices.moonpaySwap.request = fakeRequest;
    });

    it('should work properly with txHash', async () => {
      const spy = sandbox.spy(fakeRequest, 'get');
      const data = await server.externalServices.moonpaySwap.moonpaySwapGetStatus(req);
      should.exist(data);
      spy.args[0][0].should.equal('moonpaySwapApi1/getStatus?txHash=0xabc&chainId=8453');
    });

    it('should work properly with txId only', async () => {
      delete req.body.txHash;
      delete req.body.chainId;
      req.body.txId = '0xdef';
      const spy = sandbox.spy(fakeRequest, 'get');
      await server.externalServices.moonpaySwap.moonpaySwapGetStatus(req);
      spy.args[0][0].should.equal('moonpaySwapApi1/getStatus?txId=0xdef');
    });

    it('should return error if it does not have any of the required parameters', async () => {
      delete req.body.txHash;

      try {
        await server.externalServices.moonpaySwap.moonpaySwapGetStatus(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap\'s request missing arguments');
      }
    });
  });

  describe('#moonpaySwapRegisterTxs', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          txId: '0xdef',
          txHash: 'abc123',
        }
      };
      server.externalServices.moonpaySwap.request = fakeRequest;
    });

    it('should post the transaction to register', async () => {
      const spy = sandbox.spy(fakeRequest, 'post');
      const data = await server.externalServices.moonpaySwap.moonpaySwapRegisterTxs(req);
      should.exist(data);
      spy.args[0][0].should.equal('moonpaySwapApi1/registerTxs');
      spy.args[0][1].body.should.deep.equal([{ txId: '0xdef', txHash: 'abc123' }]);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.txHash;

      try {
        await server.externalServices.moonpaySwap.moonpaySwapRegisterTxs(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Moonpay Swap\'s request missing arguments');
      }
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.moonpaySwap.request = fakeRequest2;
      try {
        await server.externalServices.moonpaySwap.moonpaySwapRegisterTxs(req);
        should.fail('should have thrown');
      } catch (err) {
        loggerError.callCount.should.equal(1);
        err.message.should.equal('Failed to register Moonpay Swap transaction');
      }
    });
  });
});
