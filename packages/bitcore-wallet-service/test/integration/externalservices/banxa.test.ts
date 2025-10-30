'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

describe('Banxa integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;

  before(async function() {
    await helpers.before();
  });
  
  beforeEach(async function() {
    config.banxa = {
      sandbox: {
        api: 'api1',
        apiKey: 'apiKey1',
        secretKey: 'secretKey1',
      },
      production: {
        api: 'api2',
        apiKey: 'apiKey2',
        secretKey: 'secretKey2',
      },
      sandboxWeb: {
        api: 'api3',
        apiKey: 'apiKey3',
        secretKey: 'secretKey3',
      },
      productionWeb: {
        api: 'api4',
        apiKey: 'apiKey4',
        secretKey: 'secretKey4',
      }
    };

    fakeRequest = {
      get: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
      post: (_url, _opts, _cb) => { return _cb(null, { body: 'data' }); },
    };

    await helpers.beforeEach();
    ({ wallet } = await helpers.createAndJoinWallet(1, 1));
    const priv = TestData.copayers[0].privKey_1H_0;
    const sig = helpers.signMessage('hello world', priv);
  
    const s = await util.promisify(WalletService.getInstanceWithAuth).call(WalletService, {
      // test assumes wallet's copayer[0] is TestData's copayer[0]
      copayerId: wallet.copayers[0].id,
      message: 'hello world',
      signature: sig,
      clientVersion: 'bwc-2.0.0',
      walletId: '123',
    });
    server = s;
  });

  after(async function() {
    await helpers.after();
  });

  describe('#banxaGetPaymentMethods', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
        }
      };
      server.externalServices.banxa.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.banxa.banxaGetPaymentMethods(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.banxa.banxaGetPaymentMethods(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.banxa.request = fakeRequest2;
      try {
        await server.externalServices.banxa.banxaGetPaymentMethods(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if banxa is commented in config', async () => {
      config.banxa = undefined;
      try {
        await server.externalServices.banxa.banxaGetPaymentMethods(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa missing credentials');
      }
    });
  });

  describe('#banxaGetCoins', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          orderType: 'buy'
        }
      };
      server.externalServices.banxa.request = fakeRequest;
    });

    it('should work properly if req is OK for buy', async () => {
      const data = await server.externalServices.banxa.banxaGetCoins(req);
      should.exist(data);
    });

    it('should work properly if req is OK for sell', async () => {
      req.body.orderType = 'sell';
      const data = await server.externalServices.banxa.banxaGetCoins(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.banxa.banxaGetCoins(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.banxa.request = fakeRequest2;
      try {
        await server.externalServices.banxa.banxaGetCoins(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if orderType is not buy or sell', async () => {
      req.body.orderType = 'wrongOrderType';
      try {
        await server.externalServices.banxa.banxaGetCoins(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa\'s \'orderType\' property must be \'sell\' or \'buy\'');
      }
    });

    it('should return error if orderType is not present', async () => {
      delete req.body.orderType;
      try {
        await server.externalServices.banxa.banxaGetCoins(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa\'s request missing arguments');
      }
    });

    it('should return error if banxa is commented in config', async () => {
      config.banxa = undefined;
      try {
        await server.externalServices.banxa.banxaGetCoins(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa missing credentials');
      }
    });
  });

  describe('#banxaGetQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          source: 'USD',
          target: 'BTC'
        }
      };
      server.externalServices.banxa.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.banxa.banxaGetQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.banxa.banxaGetQuote(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.banxa.request = fakeRequest2;
      try {
        await server.externalServices.banxa.banxaGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.target;
      try {
        await server.externalServices.banxa.banxaGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa\'s request missing arguments');
      }
    });

    it('should return error if banxa is commented in config', async () => {
      config.banxa = undefined;

      try {
        await server.externalServices.banxa.banxaGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa missing credentials');
      }
    });
  });

  describe('#banxaCreateOrder', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          account_reference: 'account_reference1',
          source: 'USD',
          target: 'BTC',
          wallet_address: 'wallet_address1',
          return_url_on_success: 'return_url_on_success1'
        }
      };
      server.externalServices.banxa.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.banxa.banxaCreateOrder(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.banxa.banxaCreateOrder(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.banxa.request = fakeRequest2;
      try {
        await server.externalServices.banxa.banxaCreateOrder(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.source;
      try {
        await server.externalServices.banxa.banxaCreateOrder(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa\'s request missing arguments');
      }
    });

    it('should return error if banxa is commented in config', async () => {
      config.banxa = undefined;
      try {
        await server.externalServices.banxa.banxaCreateOrder(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa missing credentials');
      }
    });
  });

  describe('#banxaGetOrder', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          order_id: 'order_id1',
        }
      };
      server.externalServices.banxa.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.banxa.banxaGetOrder(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.banxa.banxaGetOrder(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.banxa.request = fakeRequest2;
      try {
        await server.externalServices.banxa.banxaGetOrder(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      };
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.order_id;
      try {
        await server.externalServices.banxa.banxaGetOrder(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa\'s request missing arguments');
      }
    });

    it('should return error if banxa is commented in config', async () => {
      config.banxa = undefined;

      try {
        await server.externalServices.banxa.banxaGetOrder(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Banxa missing credentials');
      }
    });
  });
});