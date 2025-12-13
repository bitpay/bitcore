'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import crypto from 'crypto';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
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
  let server;
  let wallet;
  let fakeRequest;
  let req;

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.suspendedChains = [];
    config.changelly = {
      v1: {
        apiKey: 'apiKeyV1',
        secret: 'secretV1',
        api: 'apiV1'
      },
      v2: {
        secret: privateKey.toString('hex'),
        secret_stablecoin: 'changelly_secret_stablecoin_v2',
        api: 'apiV2',
      }
    };

    fakeRequest = {
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
  });

  after(async () => {
    await helpers.after();
  });

  describe('#Changelly API key selection', () => {
    it('should use stablecoin API key for stablecoin swaps', () => {
      const stablecoins = [
        'usdt', 'usdc', 'dai', 'busd', 'tusd', 'usdp', 'usdn',
        'usdt20', 'usdtarb', 'usdtop', 'usdtpolygon', 'usdtsol',
        'usdcmatic', 'usdcarb', 'usdcbase', 'usdcop', 'usdcsol',
        'daipolygon'
      ];

      const getRandomStablecoin = () =>
        stablecoins[Math.floor(Math.random() * stablecoins.length)];
  
      for (const coin of stablecoins) {
        const _coinTo = getRandomStablecoin();
        const req = {
          body: { coinFrom: coin, coinTo: _coinTo }
        };
        const keys = server.externalServices.changelly.changellyGetKeysV2(req);
        keys.SECRET.should.equal(config.changelly.v2.secret_stablecoin);
        keys.API.should.equal(config.changelly.v2.api);
      }

      const req = {
        body: { coinFrom: 'xxx', coinTo: 'xxx' }
      };
      const keys = server.externalServices.changelly.changellyGetKeysV2(req);
      keys.SECRET.should.equal(config.changelly.v2.secret);
      keys.API.should.equal(config.changelly.v2.api);
    });
  });

  describe('#changellyGetCurrencies', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: 'test',
          useV2: true
        }
      };
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.changelly.changellyGetCurrencies(req);
      should.exist(data);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.id;
      try {
        await server.externalServices.changelly.changellyGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('changellyGetCurrencies request missing arguments');
      }
    });

    it('should return error if post returns error', async () => {
      req.body.id = 'test';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.changelly.request = fakeRequest2;
      try {
        await server.externalServices.changelly.changellyGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Changelly is commented in config', async () => {
      config.changelly = undefined;

      try {
        await server.externalServices.changelly.changellyGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('ClientError: Service not configured.');
      }
    });

    it('should return error if req is v1', async () => {
      delete req.body.useV2;

      try {
        await server.externalServices.changelly.changellyGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      }
    });
  });

  describe('#changellyGetPairsParams', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: 'test',
          coinFrom: 'btc',
          coinTo: 'eth',
          useV2: true
        }
      };
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      try {
        const data = await server.externalServices.changelly.changellyGetPairsParams(req);
        should.exist(data);
      } catch (err) {
        should.not.exist(err);
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.coinFrom;

      try {
        await server.externalServices.changelly.changellyGetPairsParams(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('changellyGetPairsParams request missing arguments');
      }
    });

    it('should return error if post returns error', async () => {
      req.body.coinFrom = 'btc';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.changelly.request = fakeRequest2;
      try {
        await server.externalServices.changelly.changellyGetPairsParams(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Changelly is commented in config', async () => {
      config.changelly = undefined;

      try {
        await server.externalServices.changelly.changellyGetPairsParams(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('ClientError: Service not configured.');
      }
    });
    
    it('should return error if req is v1', async () => {
      delete req.body.useV2;
      try {
        await server.externalServices.changelly.changellyGetPairsParams(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      }
    });
  });

  describe('#changellyGetFixRateForAmount', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: 'test',
          coinFrom: 'btc',
          coinTo: 'eth',
          amountFrom: '1.123',
          useV2: true
        }
      };
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      try {
        const data = await server.externalServices.changelly.changellyGetFixRateForAmount(req);
        should.exist(data);
      } catch (err) {
        should.not.exist(err);
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.coinFrom;

      try {
        await server.externalServices.changelly.changellyGetFixRateForAmount(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('changellyGetFixRateForAmount request missing arguments');
      }
    });

    it('should return error if post returns error', async () => {
      req.body.coinFrom = 'btc';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.changelly.request = fakeRequest2;
      try {
        await server.externalServices.changelly.changellyGetFixRateForAmount(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Changelly is commented in config', async () => {
      config.changelly = undefined;

      try {
        await server.externalServices.changelly.changellyGetFixRateForAmount(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('ClientError: Service not configured.');
      }
    });

    it('should return error if req is v1', async () => {
      delete req.body.useV2;
      try {
        await server.externalServices.changelly.changellyGetFixRateForAmount(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      }
    });
  });

  describe('#changellyCreateFixTransaction', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: 'test',
          coinFrom: 'btc',
          coinTo: 'eth',
          amountFrom: '1.123',
          addressTo: '10.321',
          fixedRateId: '3.123',
          refundAddress: 'refundAddress',
          useV2: true
        }
      };
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.changelly.changellyCreateFixTransaction(req);
      should.exist(data);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.coinFrom;

      try {
        await server.externalServices.changelly.changellyCreateFixTransaction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('changellyCreateFixTransaction request missing arguments');
      }
    });

    it('should return error if post returns error', async () => {
      req.body.coinFrom = 'btc';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.changelly.request = fakeRequest2;
      try {
        await server.externalServices.changelly.changellyCreateFixTransaction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Changelly is commented in config', async () => {
      config.changelly = undefined;

      try {
        await server.externalServices.changelly.changellyCreateFixTransaction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('ClientError: Service not configured.');
      }
    });

    it('should return error if req is v1', async () => {
      delete req.body.useV2;
      try {
        await server.externalServices.changelly.changellyCreateFixTransaction(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      }
    });
  });

  describe('#changellyGetTransactions', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: 'test',
          exchangeTxId: 'exchangeTxId',
          useV2: true
        }
      };
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.changelly.changellyGetTransactions(req);
      should.exist(data);
    });

    it('should return error if there is some missing arguments', async() => {
      delete req.body.exchangeTxId;

      try {
        await server.externalServices.changelly.changellyGetTransactions(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('changellyGetTransactions request missing arguments');
      }
    });

    it('should return error if post returns error', async() => {
      req.body.exchangeTxId = 'exchangeTxId';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };
      server.externalServices.changelly.request = fakeRequest2;

      try {
        await server.externalServices.changelly.changellyGetTransactions(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Changelly is commented in config', async() => {
      config.changelly = undefined;

      try {
        await server.externalServices.changelly.changellyGetTransactions(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('ClientError: Service not configured.');
      }
    });

    it('should return error if req is v1', async () => {
      delete req.body.useV2;
      try {
        await server.externalServices.changelly.changellyGetTransactions(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      }
    });
  });

  describe('#changellyGetStatus', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          id: 'test',
          exchangeTxId: 'exchangeTxId',
          useV2: true
        }
      };
      server.externalServices.changelly.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.changelly.changellyGetStatus(req);
      should.exist(data);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.exchangeTxId;

      try {
        await server.externalServices.changelly.changellyGetStatus(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('changellyGetStatus request missing arguments');
      }
    });

    it('should return error if post returns error', async () => {
      req.body.exchangeTxId = 'exchangeTxId';
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')); },
      };

      server.externalServices.changelly.request = fakeRequest2;
      try {
        await server.externalServices.changelly.changellyGetStatus(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Changelly is commented in config', async () => {
      config.changelly = undefined;

      try {
        await server.externalServices.changelly.changellyGetStatus(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('ClientError: Service not configured.');
      }
    });

    it('should return error if req is v1', async () => {
      delete req.body.useV2;
      try {
        await server.externalServices.changelly.changellyGetStatus(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Credentials expired, please update the app to continue using Changelly services.');
      }
    });
  });
});