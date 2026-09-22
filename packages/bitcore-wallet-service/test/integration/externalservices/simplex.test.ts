'use strict';

import * as chai from 'chai';
import 'chai/register-should';
import * as crypto from 'crypto';
import util from 'util';
import { WalletService } from '../../../src/lib/server';
import * as TestData from '../../testdata';
import helpers from '../helpers';
import config from '../../../src/config';

const should = chai.should();

// RSA keypair used to sign/verify the Simplex webhook JWT (X-Signature-SHA256).
const { privateKey: simplexPrivateKey, publicKey: simplexPublicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'pem' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
});

function buildSimplexJwt(privateKey: string, exp: number): string {
  const header = Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ exp })).toString('base64url');
  const signingInput = `${header}.${payload}`;
  const signature = crypto.createSign('RSA-SHA256').update(signingInput).sign(privateKey).toString('base64url');
  return `${signingInput}.${signature}`;
}

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

  describe('#simplexHandleWebhook', () => {
    let body;

    beforeEach(() => {
      config.simplex.production.publicKeyWebhook = simplexPublicKey;
      body = {
        name: 'wallet_status_changed',
        event_id: 'evt1',
        payment: {
          id: 'payment1',
          created_at: '2024-01-01T00:00:00.000Z',
          fiat_total_amount: { amount: '100', currency: 'USD' },
          requested_digital_amount: { currency: 'BTC' },
          user_id: 'user1'
        }
      };
      req = { headers: {}, body };
    });

    it('should verify and parse a valid webhook payload', () => {
      const exp = Math.floor(Date.now() / 1000) + 300;
      req.headers['x-signature-sha256'] = buildSimplexJwt(simplexPrivateKey, exp);
      const { event } = server.externalServices.simplex.simplexHandleWebhook(req);
      event.partner.should.equal('simplex');
      event.externalId.should.equal('payment1');
      event.status.should.equal('wallet_status_changed');
      event.deliveryVersion.should.equal('evt1');
      event.fiatAmount.should.equal(100);
      event.fiatCurrency.should.equal('USD');
      event.cryptoCurrency.should.equal('BTC');
      event.userId.should.equal('user1');
      event.env.should.equal('production');
    });

    it('should throw if the JWT is expired', () => {
      const exp = Math.floor(Date.now() / 1000) - 60;
      req.headers['x-signature-sha256'] = buildSimplexJwt(simplexPrivateKey, exp);
      try {
        server.externalServices.simplex.simplexHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex webhook signature verification failed');
      }
    });

    it('should throw if the signature does not match', () => {
      const { privateKey: otherKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: { type: 'spki', format: 'pem' },
        privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
      });
      const exp = Math.floor(Date.now() / 1000) + 300;
      req.headers['x-signature-sha256'] = buildSimplexJwt(otherKey, exp);
      try {
        server.externalServices.simplex.simplexHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex webhook signature verification failed');
      }
    });

    it('should throw if the signature header is missing while a public key is configured', () => {
      try {
        server.externalServices.simplex.simplexHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex webhook missing X-Signature-SHA256 header');
      }
    });

    it('should skip verification and still parse if no publicKeyWebhook is configured', () => {
      delete config.simplex.production.publicKeyWebhook;
      const { event } = server.externalServices.simplex.simplexHandleWebhook(req);
      event.externalId.should.equal('payment1');
    });

    it('should return error if simplex is commented in config', () => {
      config.simplex = undefined;
      try {
        server.externalServices.simplex.simplexHandleWebhook(req);
        should.fail('should have thrown');
      } catch (err) {
        err.message.should.equal('Simplex missing credentials');
      }
    });
  });
});