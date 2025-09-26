'use strict';

import chai from 'chai';
import 'chai/register-should';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

describe('Wyre integration', () => {
  let server;
  let wallet;
  let fakeRequest;
  let req;

  before(async () => {
    await helpers.before();
  });

  beforeEach(async () => {
    config.wyre = {
      sandbox: {
        apiKey: 'xxxx',
        secretApiKey: 'xxxx',
        api: 'xxxx',
        widgetUrl: 'xxxx',
        appProviderAccountId: 'xxxx'
      },
      production: {
        apiKey: 'xxxx',
        secretApiKey: 'xxxx',
        api: 'xxxx',
        widgetUrl: 'xxxx',
        appProviderAccountId: 'xxxx'
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

  describe('#wyreWalletOrderQuotation', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          amount: 50,
          sourceCurrency: 'USD',
          destCurrency: 'BTC',
          dest: 'bitcoin:123123123',
          country: 'US'
        }
      }
      server.externalServices.wyre.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.wyre.wyreWalletOrderQuotation(req);
      should.exist(data);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.amount;

      try {
        await server.externalServices.wyre.wyreWalletOrderQuotation(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Wyre\'s request missing arguments');
      }
    });

    it('should return error if post returns error', async () => {
      req.body.amount = 50;
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.externalServices.wyre.request = fakeRequest2;
      try {
        await server.externalServices.wyre.wyreWalletOrderQuotation(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Wyre is commented in config', async () => {
      config.wyre = undefined;

      try {
        await server.externalServices.wyre.wyreWalletOrderQuotation(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Wyre missing credentials');
      }
    });

    it('should return error if amountIncludeFees is true but sourceAmount is not present', async () => {
      req = {
        headers: {},
        body: {
          amountIncludeFees: true,
          env: 'sandbox',
          amount: 50,
          sourceCurrency: 'USD',
          destCurrency: 'BTC',
          dest: 'bitcoin:123123123',
          country: 'US',
          walletType: 'DEBIT_CARD'
        }
      }

      try {
        await server.externalServices.wyre.wyreWalletOrderQuotation(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Wyre\'s request missing arguments');
      }
    });

    it('should work properly if req is OK with amountIncludeFees and sourceAmount', async () => {
      req = {
        headers: {},
        body: {
          amountIncludeFees: true,
          env: 'sandbox',
          sourceAmount: 50,
          sourceCurrency: 'USD',
          destCurrency: 'BTC',
          dest: 'bitcoin:123123123',
          country: 'US',
          walletType: 'DEBIT_CARD'
        }
      }

      const data = await server.externalServices.wyre.wyreWalletOrderQuotation(req);
      should.exist(data);
    });
  });

  describe('#wyreWalletOrderReservation', () => {
    beforeEach(() => {
      req = {
        headers: {},
        body: {
          env: 'sandbox',
          amount: 50,
          sourceCurrency: 'USD',
          destCurrency: 'BTC',
          dest: 'bitcoin:123123123',
          paymentMethod: 'debit-card'
        }
      }

      fakeRequest = {
        post: (_url, _opts, _cb) => { return _cb(null, { body: {} }) },
      };
      server.externalServices.wyre.request = fakeRequest;
    });

    it('should work properly if req is OK', async () => {
      const data = await server.externalServices.wyre.wyreWalletOrderReservation(req);
      should.exist(data);
    });

    it('should return error if there is some missing arguments', async () => {
      delete req.body.amount;

      try {
        await server.externalServices.wyre.wyreWalletOrderReservation(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Wyre\'s request missing arguments');
      }
    });

    it('should return error if post returns error', async () => {
      req.body.amount = 50;
      const fakeRequest2 = {
        post: (_url, _opts, _cb) => { return _cb(new Error('Error')) },
      };

      server.externalServices.wyre.request = fakeRequest2;
      try {
        await server.externalServices.wyre.wyreWalletOrderReservation(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Error');
      }
    });

    it('should return error if Wyre is commented in config', async () => {
      config.wyre = undefined;

      try {
        await server.externalServices.wyre.wyreWalletOrderReservation(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Wyre missing credentials');
      }
    });

    it('should return error if amountIncludeFees is true but sourceAmount is not present', async () => {
      req = {
        headers: {},
        body: {
          amountIncludeFees: true,
          env: 'sandbox',
          amount: 50,
          sourceCurrency: 'USD',
          destCurrency: 'BTC',
          dest: 'bitcoin:123123123',
          country: 'US',
          paymentMethod: 'debit-card'
        }
      }

      try {
        await server.externalServices.wyre.wyreWalletOrderReservation(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Wyre\'s request missing arguments');
      }
    });

    it('should work properly if req is OK with amountIncludeFees and sourceAmount', async () => {
      req = {
        headers: {},
        body: {
          amountIncludeFees: true,
          env: 'sandbox',
          sourceAmount: 50,
          sourceCurrency: 'USD',
          destCurrency: 'BTC',
          dest: 'bitcoin:123123123',
          country: 'US',
          paymentMethod: 'debit-card'
        }
      }

      const data = await server.externalServices.wyre.wyreWalletOrderReservation(req);
      should.exist(data);
    });
  });
});