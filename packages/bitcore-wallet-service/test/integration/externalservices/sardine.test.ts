'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

describe('Sardine integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;

  before(async () => {
    await helpers.before();
  });
  
  beforeEach(async () => {
    config.sardine = {
      sandbox: {
        api: 'api1',
        secretKey: 'secretKey1',
        clientId: 'clientId1',
      },
      production: {
        api: 'api2',
        secretKey: 'secretKey2',
        clientId: 'clientId2',
      },
      sandboxWeb: {
        api: 'api3',
        secretKey: 'secretKey3',
        clientId: 'clientId3',
      },
      productionWeb: {
        api: 'api4',
        secretKey: 'secretKey4',
        clientId: 'clientId4',
      }
    }

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }) },
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }) },
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

  describe('#sardineGetQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          asset_type: 'BTC',
          network: 'bitcoin',
          total: 50,
          currency: 'USD',
          paymentType: 'debit',
          quote_type: 'buy'
        }
      }
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.sardine.sardineGetQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetQuote(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.asset_type;
      try {
        await server.externalServices.sardine.sardineGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine\'s request missing arguments');
      }
    });

    it('should return error if sardine is commented in config', async () => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineGetCurrencyLimits', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      }
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.sardine.sardineGetCurrencyLimits(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetCurrencyLimits(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetCurrencyLimits(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if sardine is commented in config', async () => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetCurrencyLimits(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineGetToken', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          referenceId: 'referenceId1',
          externalUserId: 'externalUserId1',
          customerId: 'customerId1',
        }
      }
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.sardine.sardineGetToken(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetToken(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetToken(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.referenceId;
      try {
        await server.externalServices.sardine.sardineGetToken(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine\'s request missing arguments');
      }
    });

    it('should return error if sardine is commented in config', async () => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetToken(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineGetSupportedTokens', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      }
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async() => {
      const data = await server.externalServices.sardine.sardineGetSupportedTokens(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async() => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetSupportedTokens(req);
      should.exist(data);
    });

    it('should return error if get returns error', async() => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetSupportedTokens(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if sardine is commented in config', async() => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetSupportedTokens(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });

  describe('#sardineGetOrdersDetails', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          orderId: 'orderId1',
        }
      }
      server.externalServices.sardine.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null) },
      };

      server.externalServices.sardine.request = fakeRequest2;
      try {
        await server.externalServices.sardine.sardineGetOrdersDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.orderId;
      try {
        await server.externalServices.sardine.sardineGetOrdersDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine\'s request missing arguments');
      }
    });

    it('should work properly if orderId is not present but externalUserId is', async () => {
      delete req.body.orderId;
      req.body.externalUserId = 'externalUserId1';
      const data = await server.externalServices.sardine.sardineGetOrdersDetails(req);
      should.exist(data);
    });

    it('should return error if sardine is commented in config', async () => {
      config.sardine = undefined;
      try {
        await server.externalServices.sardine.sardineGetOrdersDetails(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Sardine missing credentials');
      }
    });
  });
});