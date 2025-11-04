'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

describe('Simplex integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.simplex = {
      sandbox: {
        apiKey: 'apiKey1',
        api: 'api1',
        apiSell: 'apiSell1',
        appProviderId: 'appProviderId1',
        appSellRefId: 'appSellRefId1',
        publicKey: 'publicKey1'
      },
      production: {
        apiKey: 'apiKey2',
        api: 'api2',
        apiSell: 'apiSell2',
        appProviderId: 'appProviderId2',
        appSellRefId: 'appSellRefId2',
        publicKey: 'publicKey2'
      },
      sandboxWeb: {
        apiKey: 'apiKey3',
        api: 'api3',
        apiSell: 'apiSell3',
        appProviderId: 'appProviderId3',
        appSellRefId: 'appSellRefId3',
        publicKey: 'publicKey3'
      },
      productionWeb: {
        apiKey: 'apiKey4',
        api: 'api4',
        apiSell: 'apiSell4',
        appProviderId: 'appProviderId4',
        appSellRefId: 'appSellRefId4',
        publicKey: 'publicKey4'
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

  describe('#simplexGetCurrencies', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox'
        },
      };
      server.externalServices.simplex.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.simplex.simplexGetCurrencies(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.simplex.simplexGetCurrencies(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.simplex.request = fakeRequest2;
      try {
        await server.externalServices.simplex.simplexGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if simplex is commented in config', async () => {
      config.simplex = undefined;
      try {
        await server.externalServices.simplex.simplexGetCurrencies(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex missing credentials');
      }
    });
  });

  describe('#simplexGetQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox'
        },
        ip: '1.2.3.4'
      };
      server.externalServices.simplex.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.simplex.simplexGetQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.simplex.simplexGetQuote(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.simplex.request = fakeRequest2;
      try {
        await server.externalServices.simplex.simplexGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if simplex is commented in config', async () => {
      config.simplex = undefined;

      try {
        await server.externalServices.simplex.simplexGetQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        should.exist(err);
        err.message.should.equal('Simplex missing credentials');
      }
    });
  });

  describe('#simplexGetSellQuote', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          userCountry: 'LT',
          base_currency: 'BTC',
          base_amount: 1000000,
          quote_currency: 'EUR',
          pp_payment_method: 'sepa'
        }
      };
      server.externalServices.simplex.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.simplex.simplexGetSellQuote(req);
      should.exist(data);
    });

    it('should work properly if req is OK for web', async () => {
      req.body.context = 'web';
      const data = await server.externalServices.simplex.simplexGetSellQuote(req);
      should.exist(data);
    });

    it('should return error if get returns error', async () => {
      const fakeRequest2 = {
        get: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.simplex.request = fakeRequest2;
      try {
        await server.externalServices.simplex.simplexGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.base_amount;
      try {
        await server.externalServices.simplex.simplexGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex\'s request missing arguments');
      }
    });

    it('should return error if simplex is commented in config', async () => {
      config.simplex = undefined;
      try {
        await server.externalServices.simplex.simplexGetSellQuote(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex missing credentials');
      }
    });
  });

  describe('#simplexPaymentRequest', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'production',
          account_details: {
          },
          transaction_details: {
            payment_details: {
            }
          }
        },
        ip: '1.2.3.4'
      };

      fakeRequest = {
        post: (_url, _opts, _cb) => { return _cb(null, { body: {} }); },
      };
      server.externalServices.simplex.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.simplex.simplexPaymentRequest(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.simplex.request = fakeRequest2;
      try {
        await server.externalServices.simplex.simplexPaymentRequest(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.transaction_details;
      try {
        await server.externalServices.simplex.simplexPaymentRequest(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex\'s request missing arguments');
      }
    });

    it('should return error if simplex is commented in config', async () => {
      config.simplex = undefined;

      try {
        await server.externalServices.simplex.simplexPaymentRequest(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex missing credentials');
      }
    });
  });

  describe('#simplexSellPaymentRequest', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'production',     
          userCountry: 'LT',
          referer_url: 'https://referer_url.com/',
          return_url: 'https://return_url.com/',
          txn_details: { quote_id: 'quote_id_1' },
        },
        ip: '1.2.3.4'
      };

      fakeRequest = {
        post: (_url, _opts, _cb) => { return _cb(null, { body: {} }); },
      };
      server.externalServices.simplex.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.simplex.simplexSellPaymentRequest(req);
      should.exist(data);
    });

    it('should return error if post returns error', async () => {
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error'), null); },
      };

      server.externalServices.simplex.request = fakeRequest2;
      try {
        await server.externalServices.simplex.simplexSellPaymentRequest(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.return_url;

      try {
        await server.externalServices.simplex.simplexSellPaymentRequest(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex\'s request missing arguments');
      }
    });

    it('should return error if simplex is commented in config', async () => {
      config.simplex = undefined;

      try {
        await server.externalServices.simplex.simplexSellPaymentRequest(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex missing credentials');
      }
    });
  });

  describe('#simplexGetEvents', () => {
    beforeEach(() => {
      req = {
        env: 'production'
      };

      fakeRequest = {
        get: (_url, _opts, _cb) => { return _cb(null, { body: {} }); },
      };
      server.externalServices.simplex.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.simplex.simplexGetEvents(req);
      should.exist(data);
    });
  });
});